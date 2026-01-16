import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
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
import type { MeterWithReading } from "@shared/schema";

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
    return d.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
        لا توجد عدادات مخصصة
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        ستظهر العدادات المخصصة لك هنا
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
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [readerId, setReaderId] = useState<string | null>(null);
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

  const { data: meters = [], isLoading, refetch } = useQuery<MeterWithReading[]>({
    queryKey: ["/api/meters", readerId],
    enabled: !!readerId,
  });

  const filteredMeters = meters.filter((meter) => {
    const query = searchQuery.toLowerCase();
    return (
      meter.accountNumber.toLowerCase().includes(query) ||
      meter.sequence.toLowerCase().includes(query) ||
      meter.meterNumber.toLowerCase().includes(query) ||
      meter.subscriberName.toLowerCase().includes(query)
    );
  });

  const completedCount = meters.filter(
    (m) => m.latestReading !== null && m.latestReading !== undefined
  ).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleMeterPress = (meter: MeterWithReading) => {
    navigation.navigate("ReadingEntry", { meter });
  };

  const handleSettingsPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Settings");
  };

  const renderItem = ({ item, index }: { item: MeterWithReading; index: number }) => (
    <MeterCard
      meter={item}
      index={index}
      onPress={() => handleMeterPress(item)}
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
              {completedCount}/{meters.length} مكتملة
            </ThemedText>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: AppColors.success,
                  width: meters.length > 0 ? `${(completedCount / meters.length) * 100}%` : "0%",
                },
              ]}
            />
          </View>
        </View>
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
});
