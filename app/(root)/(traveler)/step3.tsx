import React, { useState, useEffect } from "react";
import { Text, View, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTravelerFormStore } from "@/store/travelerFormStore";
import { getPackageById, updatePackageById } from "@/services/packageService";
import { PackageModel } from "@/models/packageModel";
import CustomButton from "@/components/customButton";
import { ChevronLeftIcon } from "lucide-react-native";
import { useUser } from "@clerk/clerk-expo";
import {
  calculateDeliveryPrice,
  ContentType,
  PackageSize,
} from "@/utils/priceCalculator"; // adjust path if needed
import { calculateDistanceKm } from "@/utils/distanceUtils";
import { createTravel } from "@/services/travelService";
import { addDoc, collection, serverTimestamp, getDoc, doc as firestoreDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import * as Notifications from 'expo-notifications';

const TravellerStep3 = () => {
  const { user } = useUser();
  const userId = user?.id; // Get the user ID from the Clerk user object
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [packageDetails, setPackageDetails] = useState<PackageModel | null>(
    null
  );
  const [confirming, setConfirming] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);

  // Get the selected package data from the store
  const { data } = useTravelerFormStore();
  const { selectedPackageId, price } = data;

  useEffect(() => {
    const fetchPackageDetails = async () => {
      if (!selectedPackageId) {
        return;
      }

      try {
        setLoading(true);
        const pkg = await getPackageById(selectedPackageId);
        if (pkg) {
          setPackageDetails(pkg);
        }
      } catch (error) {
        console.error("Failed to fetch package details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackageDetails();
  }, [selectedPackageId]);

  useEffect(() => {
    if (packageDetails) {
      const {
        packageInfo: {
          pickupLocation,
          deliveryLocation,
          size,
          weight,
          content,
        },
      } = packageDetails;

      const distanceKm = calculateDistanceKm(
        pickupLocation.latitude,
        pickupLocation.longitude,
        deliveryLocation.latitude,
        deliveryLocation.longitude
      );

      // For now, we'll hardcode the travel medium.
      const travelMedium = "car"; // Or get from user input later

      const weightCategoryMap: Record<string, number> = {
        "Light (1-5 kg)": 3,
        "Medium (5-10 kg)": 7.5,
        "Heavy (10-20 Kg)": 15,
      };

      const weightLabel = packageDetails.packageInfo.weight;
      const weightKg = weightCategoryMap[weightLabel] ?? 0; // Converts string to number safely

      console.log(
        "pickup lat/lng",
        pickupLocation.latitude,
        pickupLocation.longitude
      );
      console.log(
        "delivery lat/lng",
        deliveryLocation.latitude,
        deliveryLocation.longitude
      );
      console.log("size:", size);
      console.log("weight (raw):", weight);
      console.log("content:", content);
      console.log("distanceKm:", distanceKm);
      const price = calculateDeliveryPrice({
        distanceKm,
        travelMedium,
        packageSize: size as PackageSize, // Ensure size matches the PackageSize type
        weightKg,
        contentType: content as ContentType, // Ensure content matches the ContentType type
      });

      setCalculatedPrice(price);
    }
  }, [packageDetails]);

  const handleConfirmPackage = async () => {
    if (!packageDetails || !userId) return;

    try {
      setConfirming(true);

      // 1. Update the package to assign the traveler
      if (selectedPackageId) {
        await updatePackageById(selectedPackageId, {
          travelerId: userId,
          price: calculatedPrice,
          status: "in_progress",
        });
      } else {
        console.error("Selected package ID is null.");
      }

      // 2. Create the new travel document
      const travelId = await createTravel({
        travelerId: userId,
        packageId: selectedPackageId ?? "",
        startLocation: {
          ...packageDetails.packageInfo.pickupLocation,
          city:
            packageDetails.packageInfo.pickupLocation.city || "Unknown City",
          state:
            packageDetails.packageInfo.pickupLocation.state || "Unknown State",
        },
        destinationLocation: {
          ...packageDetails.packageInfo.deliveryLocation,
          city:
            packageDetails.packageInfo.deliveryLocation.city || "Unknown City",
          state:
            packageDetails.packageInfo.deliveryLocation.state ||
            "Unknown State",
        },
        travelMedium: "car", // Or dynamically from form
        trackingNumber: packageDetails.trackingNumber,
        price: calculatedPrice,
        notes: "",
        travelStatus: "pending",
      });

      // 3. Add a notification to Firestore for the sender
      await addDoc(collection(db, 'notifications'), {
        userId: packageDetails.senderId, // The sender's user ID
        title: 'Package Accepted by Traveler',
        body: `Your package (${packageDetails.trackingNumber}) has been accepted and is now in progress.`,
        data: { packageId: selectedPackageId, status: 'in progress' },
        createdAt: serverTimestamp(),
        read: false,
      });

      // 4. Send a push notification to the sender (if they have a pushToken)
      // Fetch the sender's user document
      const senderRef = firestoreDoc(db, 'users', packageDetails.senderId);
      const senderSnap = await getDoc(senderRef);

      if (senderSnap.exists()) {
        const senderData = senderSnap.data();
        const pushTokens = senderData.pushTokens || [];

        if (pushTokens.length > 0) {
          try {
            console.log('Sending notification to sender with tokens:', pushTokens);

            // Add notification to Firestore for persistence
            await addDoc(collection(db, 'notifications'), {
              userId: packageDetails.senderId,
              title: 'Package Accepted by Traveler',
              body: `Your package (${packageDetails.trackingNumber}) has been accepted and is now in progress.`,
              data: {
                packageId: selectedPackageId,
                status: 'in_progress',
                trackingNumber: packageDetails.trackingNumber,
                travelerId: user?.id,
                createdAt: serverTimestamp()
              },
              createdAt: serverTimestamp(),
              read: false,
            });

            // Send push notification to all of sender's devices
            const message = {
              to: pushTokens,
              sound: 'default',
              title: 'Package Accepted by Traveler',
              body: `Your package (${packageDetails.trackingNumber}) has been accepted and is now in progress.`,
              data: {
                packageId: selectedPackageId,
                status: 'in_progress',
                trackingNumber: packageDetails.trackingNumber,
                travelerId: user?.id
              },
            };

            const response = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(message),
            });

            const result = await response.json();
            console.log('Push notification sent successfully:', result);

          } catch (error) {
            console.error('Error sending notification:', error);
            // Continue with the flow even if notification fails
          }
        } else {
          console.log('Sender has no push tokens registered');
        }
      } else {
        console.error('Sender document not found');
      }

      // 5. Navigate to the next screen with travelId
      router.push({
        pathname: "/traveller-journey",
        params: {
          travelId,
          destLat:
            packageDetails.packageInfo.deliveryLocation.latitude.toString(),
          destLng:
            packageDetails.packageInfo.deliveryLocation.longitude.toString(),
          packageId: selectedPackageId,
        },
      });
    } catch (error) {
      console.error("Error confirming package:", error);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white p-4">
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  if (!packageDetails) {
    return (
      <SafeAreaView className="flex-1 bg-white p-4">
        <Text>No package details found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white p-4">
      <View>
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center mb-4 gap-1"
        >
          <ChevronLeftIcon size={24} color="black" />
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-1">
        <Text className="text-4xl font-HostGorteskBold mb-4">
          Travel Summery
        </Text>
        <View>
          <Text>Package Type: {packageDetails.packageInfo.type}</Text>
          <Text>From: {packageDetails.packageInfo.pickupLocation.city}</Text>
          <Text>To: {packageDetails.packageInfo.deliveryLocation.city}</Text>
          <Text>Price: ₹{calculatedPrice}</Text>
          <Text>Tracking Number: {packageDetails.trackingNumber}</Text>
        </View>
      </View>
      <View>
        <CustomButton
          title={confirming ? "Confirming..." : "Confirm Package"}
          onPress={handleConfirmPackage}
          disabled={confirming}
        />
      </View>
    </SafeAreaView>
  );
};

export default TravellerStep3;
