import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import MetersListScreen from "@/screens/MetersListScreen";
import ReadingEntryScreen from "@/screens/ReadingEntryScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import type { MeterWithReading } from "@shared/schema";

export type RootStackParamList = {
  MetersList: undefined;
  ReadingEntry: { meter: MeterWithReading; allMeters: MeterWithReading[]; currentIndex: number };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="MetersList"
        component={MetersListScreen}
        options={{
          headerTitle: () => <HeaderTitle title="قراءات المشتركين" />,
        }}
      />
      <Stack.Screen
        name="ReadingEntry"
        component={ReadingEntryScreen}
        options={{
          headerTitle: "إدخال القراءة",
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "الإعدادات",
        }}
      />
    </Stack.Navigator>
  );
}
