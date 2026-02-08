import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import * as ExpoFileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import * as XLSX from "xlsx";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { getExportDataFromLocalDB } from "@/lib/local-db";
import { syncPendingReadings } from "@/lib/sync-utils";

interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
}

function SettingsItem({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
}: SettingsItemProps) {
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
        {
          backgroundColor: theme.backgroundDefault,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Feather name={icon} size={20} color={AppColors.primary} />
      </View>
      <View style={styles.itemContent}>
        <ThemedText style={styles.itemTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText
            style={[styles.itemSubtitle, { color: theme.textSecondary }]}
          >
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

interface ReaderProfile {
  id: string;
  username: string;
  displayName: string;
  stats: {
    totalMeters: number;
    completedMeters: number;
    totalReadings: number;
  };
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { reader, logout } = useAuth();
  const [readerProfile, setReaderProfile] = useState<ReaderProfile | null>(
    null,
  );
  const [isExporting, setIsExporting] = useState(false);

  const readerId = reader?.id || null;

  useEffect(() => {
    if (readerId) {
      fetchReaderProfile(readerId);
    }
  }, [readerId]);

  const fetchReaderProfile = async (id: string) => {
    try {
      const url = new URL(`/api/reader/${id}`, getApiUrl());
      const response = await fetch(url.toString());
      const data = await response.json();
      setReaderProfile(data);
    } catch (error) {
      console.error("Error fetching reader profile:", error);
    }
  };

  const handleLogout = async () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد من تسجيل الخروج؟", [
      {
        text: "إلغاء",
        style: "cancel",
      },
      {
        text: "خروج",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  };

  const handleExport = async () => {
    if (!readerId) {
      Alert.alert("خطأ", "لم يتم تحميل بيانات القارئ");
      return;
    }

    setIsExporting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Use local database instead of API to include unsynced readings
      const data = getExportDataFromLocalDB(readerId);

      const fileName = `meter_readings_${new Date().toISOString().split("T")[0]}.json`;

      // Use legacy API with any cast
      const fs = ExpoFileSystem as any;
      const docDir = fs.documentDirectory;
      
      if (!docDir) {
        throw new Error("Could not access document directory");
      }

      const filePath = `${docDir}${fileName}`;

      await fs.writeAsStringAsync(filePath, JSON.stringify(data, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/json",
          dialogTitle: "تصدير القراءات",
        });
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
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

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { successCount, failCount, errors } = await syncPendingReadings();

      if (successCount > 0) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("تمت المزامنة", `تمت مزامنة ${successCount} قراءة بنجاح${failCount > 0 ? `، ${failCount} فشلت` : ''}.`);
      } else if (failCount > 0) {
        const errorMessage = errors.length > 0 ? errors[0] : `فشلت مزامنة ${failCount} قراءة.`;
        Alert.alert("فشلت المزامنة", errorMessage);
      } else {
        Alert.alert("لا توجد بيانات", "جميع القراءات مزامنة بالفعل.");
      }
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء المزامنة");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExcelExport = async () => {
    if (!readerId) {
      Alert.alert("خطأ", "لم يتم تحميل بيانات القارئ");
      return;
    }

    setIsExporting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const data = getExportDataFromLocalDB(readerId);
      console.log(`Exporting data for reader ${readerId}. Meters count: ${data.meters?.length || 0}`);
      
      // Prepare Excel data
      const workbook = XLSX.utils.book_new();

      // Create meters sheet
      if (data.meters && Array.isArray(data.meters)) {
        const metersData = data.meters.map((meter: any) => ({
          "رقم الحساب": meter.accountNumber,
          تسلسل: meter.sequence,
          "رقم المقياس": meter.meterNumber,
          الصنف: meter.category,
          "اسم المشترك": meter.subscriberName,
          العنوان: `${meter.address.record || ""} ${meter.address.block || ""} ${meter.address.property || ""}`,
          القراءة_previous: meter.previousReading,
          "تاريخ القراءة_previous": meter.previousReadingDate
            ? new Date(meter.previousReadingDate).toLocaleDateString("ar-IQ")
            : "",
          "المبلغ الحالي": meter.amounts?.currentAmount || 0,
          الديون: meter.amounts?.debts || 0,
          المجموع: meter.amounts?.totalAmount || 0,
          "القراءات المكتملة": meter.readings?.length || 0,
        }));

        const metersSheet = XLSX.utils.json_to_sheet(metersData);
        XLSX.utils.book_append_sheet(workbook, metersSheet, "المشتركين");
      }

      // Create readings sheet if readings exist
      if (data.meters && Array.isArray(data.meters)) {
        const allReadings: any[] = [];
        data.meters.forEach((meter: any) => {
          if (meter.readings && Array.isArray(meter.readings)) {
            meter.readings.forEach((reading: any) => {
              allReadings.push({
                "رقم الحساب": meter.accountNumber,
                "اسم المشترك": meter.subscriberName,
                الصنف: meter.category,
                العنوان: `${meter.address.record || ""} ${meter.address.block || ""} ${meter.address.property || ""}`,
                "القراءة الجديدة": reading.newReading,
                الفرق:
                  reading.newReading !== null
                    ? reading.newReading - (meter.previousReading || 0)
                    : "",
                "سبب التخطي": reading.skipReason || "",
                "تاريخ القراءة": reading.createdAt
                  ? new Date(reading.createdAt).toLocaleDateString("ar-IQ") +
                    " " +
                    new Date(reading.createdAt).toLocaleTimeString("ar-IQ")
                  : "",
                "خط العرض": reading.latitude || "",
                "خط الطول": reading.longitude || "",
                الملاحظات: reading.notes || "",
                "اسم ملف الصورة": reading.photoPath || "",
              });
            });
          }
        });

        if (allReadings.length > 0) {
          const readingsSheet = XLSX.utils.json_to_sheet(allReadings);
          XLSX.utils.book_append_sheet(workbook, readingsSheet, "القراءات");
        }
      }

      // Generate Excel file
      const base64String = XLSX.write(workbook, {
        type: "base64",
        bookType: "xlsx",
      });

      // Save to file
      const fileName = `meter_readings_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Use legacy API with any cast
      const fs = ExpoFileSystem as any;
      const docDir = fs.documentDirectory;
      
      if (!docDir) {
        throw new Error("Could not access document directory");
      }

      const fileUri = `${docDir}${fileName}`;
      await fs.writeAsStringAsync(fileUri, base64String, {
        encoding: "base64",
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "تصدير القراءات بصيغة Excel",
        });
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } else {
        Alert.alert("تم التصدير", `تم حفظ ملف Excel: ${fileName}`);
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "حدث خطأ أثناء تصدير البيانات إلى Excel");
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
      <View
        style={[
          styles.profileCard,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <Image
          source={require("../../assets/images/avatar-reader.png")}
          style={styles.avatar}
          resizeMode="cover"
        />
        <View style={styles.profileInfo}>
          <ThemedText type="h3" style={styles.profileName}>
            {readerProfile?.displayName || "قارئ المشتركين"}
          </ThemedText>
          <ThemedText
            style={[styles.profileId, { color: theme.textSecondary }]}
          >
            {readerProfile?.username || "جاري التحميل..."}
          </ThemedText>
        </View>
      </View>

      {readerProfile ? (
        <View
          style={[
            styles.statsCard,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.statItem}>
            <ThemedText
              style={[styles.statValue, { color: AppColors.primary }]}
            >
              {readerProfile.stats.totalMeters}
            </ThemedText>
            <ThemedText
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              إجمالي المشتركين
            </ThemedText>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <ThemedText
              style={[styles.statValue, { color: AppColors.success }]}
            >
              {readerProfile.stats.completedMeters}
            </ThemedText>
            <ThemedText
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              تم قراءتها
            </ThemedText>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: AppColors.accent }]}>
              {readerProfile.stats.totalReadings}
            </ThemedText>
            <ThemedText
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              القراءات المسجلة
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          الإعدادات العامة
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
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
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          البيانات
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <SettingsItem
            icon="download"
            title={isExporting ? "جاري التصدير..." : "تصدير القراءات"}
            subtitle="تصدير جميع القراءات والصور"
            onPress={handleExport}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsItem
            icon="file-text"
            title={isExporting ? "جاري التصدير..." : "تصدير إلى Excel"}
            subtitle="تصدير القراءات بصيغة Excel"
            onPress={handleExcelExport}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsItem
            icon="refresh-cw"
            title={isSyncing ? "جاري المزامنة..." : "مزامنة البيانات"}
            subtitle={isSyncing ? "يرجى الانتظار" : "اضغط للمزامنة يدوياً"}
            onPress={handleSync}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          حول التطبيق
        </ThemedText>
        <View
          style={[
            styles.sectionContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <SettingsItem
            icon="info"
            title="الإصدار"
            subtitle="1.0.0"
            showArrow={false}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingsItem icon="help-circle" title="المساعدة والدعم" />
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="log-out" size={20} color="#FFFFFF" />
          <ThemedText style={styles.logoutText}>تسجيل الخروج</ThemedText>
        </Pressable>
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
  statsCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: Spacing.md,
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
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.error,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
  },
});
