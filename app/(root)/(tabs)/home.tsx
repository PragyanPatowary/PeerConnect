import CustomButton from "@/components/customButton";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useUser } from "@clerk/clerk-expo";

const Home = () => {
  const { user } = useUser();

  return (
    <SafeAreaView className="flex flex-1 h-full w-full bg-gray-200 items-center justify-center">
      <Text className="font-HostGorteskBold text-2xl text-center px-8">
        Welcome{" "}
        {user?.firstName || user?.emailAddresses[0].emailAddress.split("@")[0]}{" "}
        To Peer Connect
      </Text>
      <View className="flex flex-row gap-4 mx-8">
        <CustomButton
          title={`I am Traveling`}
          className="mt-5 flex-1"
          onPress={() => router.push("/(root)/(traveler)/traveler-info-form")}
        />
        <CustomButton
          title={`I am Sending`}
          className="mt-5 flex-1"
          onPress={() => router.push("/(root)/(sender)/package-info-form")}
          bgVariant="success"
        />
      </View>
    </SafeAreaView>
  );
};

export default Home;
