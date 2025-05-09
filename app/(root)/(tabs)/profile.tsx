import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import CustomButton from "@/components/customButton";
import { router } from "expo-router";
import { ArrowLeft, ChevronLeft, Settings, UserCog } from "lucide-react-native";
import { images } from "@/constant";
import { getUserById } from "@/services/userService";
import { User } from "@/models/userModel";

const profile = () => {
  const { user } = useUser();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { signOut } = useAuth();

  // for logout
  const onSginOutPress = async () => {
    try {
      await signOut();
      router.replace("/(auth)/sign-in"); // Navigate to SignIn screen after logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user || !user.id) {
        Alert.alert("Error", "User is not authenticated");
        setLoading(false);
        return;
      }
      try {
        const data = await getUserById(user?.id);
        if (data) {
          setUserData(data);
        } else {
          Alert.alert(
            "No Data",
            "User profile does not exist in the database."
          );
        }
      } catch (error: any) {
        Alert.alert("Error Fetching Profile", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0000ff" />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView className="flex-1 bg-white p-4">
      <TouchableWithoutFeedback
        onPress={() => router.push("/(root)/(tabs)/home")}
      >
        <View className="flex-row items-center gap-4">
          <ArrowLeft color={"black"} />
          <Text className="font-DMSansMedium">Profile</Text>
        </View>
      </TouchableWithoutFeedback>

      <View className="py-6 px-2">
        <View className="flex-row gap-6 items-center">
          <View>
            <Image source={images.avatar_2} className="h-16 w-16" />
          </View>
          <View>
            <Text className="font-DMSansMedium">Hello,</Text>
            <Text className="font-HostGorteskBold text-xl">
              {userData?.firstName} {userData?.lastName}
            </Text>
          </View>
        </View>
        <View className="gap-6 mt-6 border-b border-gray-200">
          <View>
            <Text className="font-HostGorteskMedium">My Earnings</Text>
            <View className="bg-blue-50 h-20 justify-center items-center mt-2 rounded-xl">
              <Text className="text-gray-400">Travel to start earning</Text>
            </View>
          </View>
          <TouchableOpacity
            className="flex-row items-center gap-4 py-4 mb-4"
            onPress={() => router.push("/(root)/account-settings")}
          >
            <UserCog color={"black"} />
            <Text className="font-DMSansMedium">Account Settings</Text>
          </TouchableOpacity>
        </View>
        <View>
          <CustomButton
            title="log out"
            bgVariant="danger"
            onPress={onSginOutPress}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default profile;
