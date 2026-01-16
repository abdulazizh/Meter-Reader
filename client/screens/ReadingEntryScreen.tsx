import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Shadows, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ReadingEntryScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "ReadingEntry">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { meter } = route.params;

  const [newReading, setNewReading] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const mutation = useMutation({
    mutationFn: async (data: { newReading: number; photoPath?: string; notes?: string }) => {
      const response = await apiRequest("POST", "/api/readings", {
        meterId: meter.id,
        readerId: meter.readerId,
        newReading: data.newReading,
        photoPath: data.photoPath,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/meters"] });
      Alert.alert("تم الحفظ", "تم حفظ القراءة بنجاح", [
        { text: "حسناً", onPress: () => navigation.goBack() },
      ]);
    },
    onError: async (error) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "حدث خطأ أثناء حفظ القراءة");
    },
  });

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleTakePhoto = async () => {
    if (!cameraPermission?.granted) {
      if (cameraPermission?.status === "denied" && !cameraPermission?.canAskAgain) {
        if (Platform.OS !== "web") {
          Alert.alert(
            "صلاحية الكاميرا",
            "يرجى تفعيل صلاحية الكاميرا من الإعدادات",
            [
              { text: "إلغاء", style: "cancel" },
              {
                text: "فتح الإعدادات",
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (e) {}
                },
              },
            ]
          );
        }
        return;
      }
      await requestCameraPermission();
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCamera(true);
  };

  const handleCapture = async () => {
    if (cameraRef) {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.8,
      });
      if (photo) {
        setPhotoUri(photo.uri);
        setShowCamera(false);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    if (!newReading.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("تنبيه", "يرجى إدخال القراءة الجديدة");
      return;
    }

    const readingValue = parseInt(newReading, 10);
    if (isNaN(readingValue)) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("تنبيه", "يرجى إدخال قيمة رقمية صحيحة");
      return;
    }

    if (readingValue < meter.previousReading) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("تنبيه", "القراءة الجديدة يجب أن تكون أكبر من أو تساوي القراءة السابقة");
      return;
    }

    const photoFileName = photoUri
      ? `${meter.sequence}_${meter.accountNumber}.jpg`
      : undefined;

    mutation.mutate({
      newReading: readingValue,
      photoPath: photoFileName,
      notes: notes.trim() || undefined,
    });
  };

  const canSave = newReading.trim().length > 0;

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={(ref) => setCameraRef(ref)}
          style={styles.camera}
          facing="back"
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <Pressable
                onPress={() => setShowCamera(false)}
                style={styles.cameraCloseButton}
              >
                <Feather name="x" size={28} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={styles.cameraFooter}>
              <Pressable
                onPress={handleCapture}
                style={styles.captureButton}
              >
                <View style={styles.captureButtonInner} />
              </Pressable>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.meterInfoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            معلومات العداد
          </ThemedText>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                رقم الحساب
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: AppColors.primary }]}>
                {meter.accountNumber}
              </ThemedText>
            </View>

            <View style={styles.infoItem}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                التسلسل
              </ThemedText>
              <ThemedText style={styles.infoValue}>
                {meter.sequence}
              </ThemedText>
            </View>

            <View style={styles.infoItem}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                رقم المقياس
              </ThemedText>
              <ThemedText style={styles.infoValue}>
                {meter.meterNumber}
              </ThemedText>
            </View>

            <View style={styles.infoItem}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                الصنف
              </ThemedText>
              <ThemedText style={styles.infoValue}>
                {meter.category}
              </ThemedText>
            </View>

            <View style={[styles.infoItem, styles.infoItemFull]}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                القراءة السابقة
              </ThemedText>
              <View style={styles.previousReadingRow}>
                <ThemedText style={[styles.previousReadingValue, { color: AppColors.primary }]}>
                  {meter.previousReading.toLocaleString("ar-IQ")}
                </ThemedText>
                <ThemedText style={[styles.previousReadingDate, { color: theme.textSecondary }]}>
                  {formatDate(meter.previousReadingDate)}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.inputSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            القراءة الجديدة
          </ThemedText>

          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="hash" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.readingInput, { color: theme.text }]}
              placeholder="أدخل القراءة الجديدة"
              placeholderTextColor={theme.textSecondary}
              value={newReading}
              onChangeText={setNewReading}
              keyboardType="number-pad"
              testID="input-new-reading"
            />
          </View>
        </View>

        <View style={styles.photoSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            صورة المقياس
          </ThemedText>

          {photoUri ? (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={styles.photoPreviewContainer}
            >
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => setPhotoUri(null)}
                style={[styles.removePhotoButton, { backgroundColor: AppColors.error }]}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
          ) : (
            <View style={styles.photoButtons}>
              <AnimatedPressable
                onPress={handleTakePhoto}
                style={[
                  styles.photoButton,
                  { backgroundColor: theme.backgroundDefault, borderColor: AppColors.accent },
                  animatedButtonStyle,
                ]}
                testID="button-take-photo"
              >
                <Feather name="camera" size={32} color={AppColors.accent} />
                <ThemedText style={[styles.photoButtonText, { color: AppColors.accent }]}>
                  التقاط صورة
                </ThemedText>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={handlePickImage}
                style={[
                  styles.photoButton,
                  { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  animatedButtonStyle,
                ]}
                testID="button-pick-image"
              >
                <Feather name="image" size={32} color={theme.textSecondary} />
                <ThemedText style={[styles.photoButtonText, { color: theme.textSecondary }]}>
                  اختيار من المعرض
                </ThemedText>
              </AnimatedPressable>
            </View>
          )}
        </View>

        <View style={styles.notesSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            ملاحظات (اختياري)
          </ThemedText>

          <View style={[styles.notesContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <TextInput
              style={[styles.notesInput, { color: theme.text }]}
              placeholder="أضف ملاحظات إضافية..."
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              testID="input-notes"
            />
          </View>
        </View>

        <View style={styles.saveSection}>
          <Pressable
            onPress={handleSave}
            disabled={!canSave || mutation.isPending}
            style={[
              styles.saveButton,
              {
                backgroundColor: canSave ? AppColors.primary : theme.pending,
                opacity: mutation.isPending ? 0.7 : 1,
              },
            ]}
            testID="button-save"
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={22} color="#FFFFFF" />
                <ThemedText style={styles.saveButtonText}>
                  حفظ القراءة
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  meterInfoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontFamily: "Cairo_600SemiBold",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.sm,
  },
  infoItem: {
    width: "50%",
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoItemFull: {
    width: "100%",
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
  },
  previousReadingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.md,
  },
  previousReadingValue: {
    fontSize: 24,
    fontFamily: "Cairo_700Bold",
  },
  previousReadingDate: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
  },
  inputSection: {
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  readingInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "right",
  },
  photoSection: {
    marginBottom: Spacing.xl,
  },
  photoButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  photoButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  photoButtonText: {
    marginTop: Spacing.sm,
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  photoPreviewContainer: {
    position: "relative",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  removePhotoButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notesSection: {
    marginBottom: Spacing.xl,
  },
  notesContainer: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  notesInput: {
    fontSize: 16,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
    minHeight: 100,
  },
  saveSection: {
    marginTop: Spacing.lg,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    padding: Spacing.xl,
    paddingTop: 60,
  },
  cameraCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraFooter: {
    alignItems: "center",
    paddingBottom: 60,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
  },
});
