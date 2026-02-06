import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
  Pressable,
  Image,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from "react-native";
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Shadows, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { getPendingReadings, removePendingReading, PendingReading } from "@/lib/offline-storage";
import { uploadPhotoToServer } from "@/lib/api-utils";
import type { MeterWithReading } from "@shared/schema";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearLocalDB, saveMeterToLocalDB, getMetersFromLocalDB, getPendingReadingsFromDB, markReadingAsSynced } from "@/lib/local-db";

const LOCAL_ASSIGNMENT_VERSION_KEY = "@assignment_version";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MeterCardProps {
  meter: MeterWithReading;
  index: number;
  onPress: () => void;
}

function MeterCard({ meter, index, onPress }: MeterCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const isCompleted = meter.latestReading !== null && meter.latestReading !== undefined;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.meterCard,
        { backgroundColor: theme.backgroundDefault, borderColor: isCompleted ? theme.success : theme.border },
        isCompleted && styles.meterCardCompleted,
        animatedStyle,
      ]}
      testID={`card-meter-${meter.id}`}
    >
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <View style={styles.cardHeader}>
          <View style={styles.subscriberInfo}>
            <ThemedText style={styles.subscriberName} numberOfLines={1}>
              {meter.subscriberName}
            </ThemedText>
            <ThemedText style={[styles.accountNumber, { color: theme.textSecondary }]}>
              {meter.accountNumber}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isCompleted ? theme.success : theme.pending },
            ]}
          >
            <Feather
              name={isCompleted ? "check" : "clock"}
              size={14}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.addressInfo}>
            <ThemedText style={[styles.addressText, { color: theme.textSecondary }]}>
              سجل {meter.record} / بلوك {meter.block} / عقار {meter.property}
            </ThemedText>
          </View>

          <View style={styles.rowDivider}>
            <View style={styles.infoColumn}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                الصنف
              </ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                {meter.category}
              </ThemedText>
            </View>
            <View style={styles.infoColumn}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                المجموع
              </ThemedText>
              <ThemedText style={[styles.value, { color: AppColors.primary }]}>
                {Number(meter.totalAmount).toLocaleString("ar-IQ")} د.ع
              </ThemedText>
            </View>
          </View>

          <View style={[styles.previousReading, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.infoColumn}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                القراءة السابقة
              </ThemedText>
              <ThemedText style={[styles.readingValue, { color: AppColors.primary }]}>
                {meter.previousReading.toLocaleString("ar-IQ")}
              </ThemedText>
            </View>
            <View style={styles.infoColumn}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                التاريخ
              </ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                {formatDate(meter.previousReadingDate)}
              </ThemedText>
            </View>
          </View>
        </View>
      </Animated.View>
    </AnimatedPressable>
  );
}

function EmptyState() {
  const { theme } = useTheme();
  
  return (
    <View style={styles.emptyContainer}>
      <Image
        source={require("../../assets/images/empty-meters.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <ThemedText type="h4" style={styles.emptyTitle}>
        لا يوجد مشتركين مخصصين
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        سيظهر المشتركين المخصصين لك هنا
      </ThemedText>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={AppColors.primary} />
      <ThemedText style={styles.loadingText}>جاري التحميل...</ThemedText>
    </View>
  );
}

export default function MetersListScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { reader } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReadings, setPendingReadings] = useState<PendingReading[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const readerId = reader?.id || null;
  const [localMeters, setLocalMeters] = useState<MeterWithReading[]>([]);

  const { data: apiMeters, isLoading: isApiLoading, refetch } = useQuery<MeterWithReading[]>({
    queryKey: ["/api/meters", readerId],
    enabled: !!readerId,
  });

  // Load from local DB on mount or when readerId changes
  const loadFromLocalDB = useCallback(() => {
    if (readerId) {
      const storedMeters = getMetersFromLocalDB(readerId);
      setLocalMeters(storedMeters);
    }
  }, [readerId]);

  useEffect(() => {
    loadFromLocalDB();
  }, [loadFromLocalDB]);

  const isLoading = isApiLoading && localMeters.length === 0;

  const loadPending = useCallback(async () => {
    const pending = getPendingReadingsFromDB();
    setPendingReadings(pending);
  }, []);

  // Merge meters with pending readings for immediate UI feedback
  const combinedMeters = useMemo(() => {
    const baseMeters = (apiMeters && apiMeters.length > 0) ? apiMeters : localMeters;
    
    // Create a map of pending readings for quick lookup
    const pendingMap = new Map();
    pendingReadings.forEach(pr => {
      pendingMap.set(pr.meterId, pr);
    });

    if (pendingMap.size === 0) return baseMeters;

    return baseMeters.map(meter => {
      const pending = pendingMap.get(meter.id);
      if (pending) {
        return {
          ...meter,
          latestReading: {
            id: pending.id,
            newReading: pending.newReading,
            meterId: meter.id,
            readerId: meter.readerId,
            photoPath: pending.photoFileName,
            notes: pending.notes,
            skipReason: pending.skipReason,
            createdAt: pending.createdAt,
            readingDate: pending.createdAt,
            isCompleted: true,
            latitude: pending.latitude,
            longitude: pending.longitude
          }
        };
      }
      return meter;
    });
  }, [apiMeters, localMeters, pendingReadings]);

  const filteredMeters = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return combinedMeters.filter((meter) => {
      return (
        meter.accountNumber.toLowerCase().includes(query) ||
        meter.sequence.toLowerCase().includes(query) ||
        meter.meterNumber.toLowerCase().includes(query) ||
        meter.subscriberName.toLowerCase().includes(query)
      );
    });
  }, [combinedMeters, searchQuery]);

  const completedCount = useMemo(() => {
    return combinedMeters.filter(
      (m) => m.latestReading !== null && m.latestReading !== undefined
    ).length;
  }, [combinedMeters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleMeterPress = (meter: MeterWithReading, index: number) => {
    navigation.navigate("ReadingEntry", { 
      meter, 
      allMeters: filteredMeters, 
      currentIndex: index 
    });
  };

  const handleSync = async (showAlert = true) => {
    if (isSyncing || pendingReadings.length === 0) return;

    setIsSyncing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let successCount = 0;
    let failCount = 0;
    const readingsToProcess = [...pendingReadings]; // Create a copy to avoid processing issues

    for (const reading of readingsToProcess) {
      try {
        // رفع الصورة أولاً إذا كانت موجودة
        let photoPath = reading.photoFileName;
        if (reading.photoUri && reading.photoFileName) {
          console.log(`Uploading photo for reading ${reading.id}...`);
          const uploadedPath = await uploadPhotoToServer(reading.photoUri, reading.photoFileName);
          if (uploadedPath) {
            photoPath = uploadedPath;
          }
        }

        const res = await apiRequest("POST", "/api/readings", {
          meterId: reading.meterId,
          readerId: reading.readerId,
          newReading: reading.newReading,
          photoPath: photoPath,
          notes: reading.notes,
          skipReason: reading.skipReason,
          latitude: reading.latitude?.toString(),
          longitude: reading.longitude?.toString(),
        });

        if (res.ok) {
          markReadingAsSynced(reading.id);
          successCount++;
          console.log(`Successfully synced reading ${reading.id}`);
          // Force refresh meters to update the UI and mark meter as completed
          setTimeout(() => {
            refetch();
          }, 1000);
        } else {
          const errorText = await res.text();
          console.log(`Failed to sync reading ${reading.id}:`, errorText);
          failCount++;
        }
      } catch (error) {
        console.error("Sync error for reading:", reading.id, error);
        failCount++;
      }
    }

    setIsSyncing(false);
    await loadPending();
    await refetch();

    if (successCount > 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Only show alert if user manually triggered sync
    if (failCount === 0 && successCount > 0) {
      Alert.alert("تمت المزامنة", `تمت مزامنة ${successCount} قراءة بنجاح.`);
    } else if (failCount > 0) {
      // Don't show alert for automatic sync attempts to avoid spam
      console.log(`Automatic sync: ${successCount} succeeded, ${failCount} failed`);
    }
  };

  const handleSettingsPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Settings");
  };

  const renderItem = ({ item, index }: { item: MeterWithReading; index: number }) => (
    <MeterCard
      meter={item}
      index={index}
      onPress={() => handleMeterPress(item, index)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="بحث بالرقم أو التسلسل..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="input-search"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={handleSettingsPress}
            style={[styles.settingsButton, { backgroundColor: theme.backgroundDefault }]}
            testID="button-settings"
          >
            <Feather name="settings" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.progressInfo}>
            <ThemedText style={styles.progressText}>
              التقدم
            </ThemedText>
            <ThemedText style={[styles.progressCount, { color: AppColors.primary }]}>
              {completedCount}/{combinedMeters.length} مكتملة
            </ThemedText>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: AppColors.success,
                  width: combinedMeters.length > 0 ? `${(completedCount / combinedMeters.length) * 100}%` : "0%",
                },
              ]}
            />
          </View>
        </View>

        {pendingReadings.length > 0 && (
          <Pressable
            onPress={() => handleSync(true)}
            disabled={isSyncing}
            style={[
              styles.syncNotification,
              { backgroundColor: AppColors.accent, borderColor: AppColors.accent }
            ]}
          >
            <View style={styles.syncContent}>
              <Feather name="refresh-cw" size={18} color="#FFFFFF" style={isSyncing ? styles.syncingIcon : null} />
              <ThemedText style={styles.syncText}>
                {isSyncing ? "جاري المزامنة..." : `لديك ${pendingReadings.length} قراءات بانتظار المزامنة`}
              </ThemedText>
            </View>
            {!isSyncing && (
              <View style={styles.syncBadge}>
                <ThemedText style={styles.syncBadgeText}>مزامنة يدوية</ThemedText>
              </View>
            )}
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filteredMeters}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={AppColors.primary}
              colors={[AppColors.primary]}
              title="اسحب للتحديث"
            />
          }
          ListEmptyComponent={<EmptyState />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
  },
  settingsButton: {
    width: Spacing.inputHeight,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  progressText: {
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
  },
  progressCount: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  separator: {
    height: Spacing.md,
  },
  meterCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  meterCardCompleted: {
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  subscriberInfo: {
    flex: 1,
    paddingLeft: Spacing.md,
  },
  subscriberName: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  accountNumber: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    marginTop: 2,
  },
  addressInfo: {
    marginBottom: Spacing.md,
  },
  addressText: {
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  rowDivider: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  infoColumn: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  valueMain: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    color: AppColors.primary,
  },
  previousReading: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  readingValue: {
    fontSize: 20,
    fontFamily: "Cairo_700Bold",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["5xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: 16,
  },
  syncNotification: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
  syncContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  syncText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 14,
  },
  syncBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  syncBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Cairo_700Bold",
  },
  syncingIcon: {
    // We could add an animation here if we wanted
  }
});
