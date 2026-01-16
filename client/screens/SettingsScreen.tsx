import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Image, Pressable, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
}

function SettingsItem({ icon, title, subtitle, onPress, showArrow = true }: SettingsItemProps) {
  const { theme } = useTheme();

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.settingsItem,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name={icon} size={20} color={AppColors.primary} />
      </View>
      <View style={styles.itemContent}>
        <ThemedText style={styles.itemTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.itemSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {showArrow ? (
        <Feather name="chevron-left" size={20} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [readerId, setReaderId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const hasSeeded = useRef(false);

  useEffect(() => {
    const seedData = async () => {
      if (hasSeeded.current) return;
      hasSeeded.current = true;
      try {
        const response = await apiRequest("POST", "/api/seed", {});
        const data = await response.json();
        if (data.readerId) {
          setReaderId(data.readerId);
        }
      } catch (error) {
        console.error("Error seeding data:", error);
      }
    };
    seedData();
  }, []);

  const handleExport = async () => {
    if (!readerId) {
      Alert.alert("خطأ", "لم يتم تحميل بيانات القارئ");
      return;
    }

    setIsExporting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const url = new URL(`/api/export/${readerId}`, getApiUrl());
      const response = await fetch(url.toString());
      const data = await response.json();

      const fileName = `meter_readings_${new Date().toISOString().split('T')[0]}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/json",
          dialogTitle: "تصدير القراءات",
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("تم التصدير", `تم حفظ الملف: ${fileName}`);
      }
    } catch (error) {
      console.error("Error exporting:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "حدث خطأ أثناء تصدير البيانات");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profileCard, { backgroundColor: theme.backgroundDefault }]}>
        <Image
          source={require("../../assets/images/avatar-reader.png")}
          style={styles.avatar}
          resizeMode="cover"
        />
        <View style={styles.profileInfo}>
          <ThemedText type="h3" style={styles.profileName}>
            قارئ العدادات
          </ThemedText>
          <ThemedText style={[styles.profileId, { color: theme.textSecondary }]}>
            {readerId ? `معرف القارئ: ${readerId.slice(0, 8)}...` : "جاري التحميل..."}
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          الإعدادات العامة
        </ThemedText>
        <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault }]}>
          <SettingsItem
            icon="bell"
            title="الإشعارات"
            subtitle="تفعيل إشعارات القراءات الجديدة"
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsItem
            icon="moon"
            title="المظهر"
            subtitle="تلقائي (حسب النظام)"
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          البيانات
        </ThemedText>
        <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault }]}>
          <SettingsItem
            icon="download"
            title={isExporting ? "جاري التصدير..." : "تصدير القراءات"}
            subtitle="تصدير جميع القراءات والصور"
            onPress={handleExport}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsItem
            icon="refresh-cw"
            title="مزامنة البيانات"
            subtitle="آخر مزامنة: الآن"
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          حول التطبيق
        </ThemedText>
        <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault }]}>
          <SettingsItem
            icon="info"
            title="الإصدار"
            subtitle="1.0.0"
            showArrow={false}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsItem
            icon="help-circle"
            title="المساعدة والدعم"
          />
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginLeft: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: "Cairo_700Bold",
    marginBottom: Spacing.xs,
  },
  profileId: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  sectionContent: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
  },
  itemSubtitle: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
});
