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
  ScrollView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
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
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { saveReadingToLocalDB } from "@/lib/local-db";
import { uploadPhotoToServer } from "@/lib/api-utils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SKIP_REASONS = [
  { id: "closed", label: "مغلق" },
  { id: "broken", label: "عاطل" },
  { id: "not_found", label: "غير موجود" },
  { id: "demolished", label: "مهدوم" },
  { id: "other", label: "سبب آخر" },
];

export default function ReadingEntryScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "ReadingEntry">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { meter, allMeters, currentIndex } = route.params;

  const [newReading, setNewReading] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [otherReason, setOtherReason] = useState("");

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [isSaving, setIsSaving] = useState(false);

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allMeters.length - 1;
  const isCompleted = meter.latestReading !== null && meter.latestReading !== undefined;

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const mutation = useMutation({
    mutationFn: async (data: { newReading: number; photoPath?: string; notes?: string; latitude?: number; longitude?: number }) => {
      const response = await apiRequest("POST", "/api/readings", {
        meterId: meter.id,
        readerId: meter.readerId,
        newReading: data.newReading,
        photoPath: data.photoPath,
        notes: data.notes,
        latitude: data.latitude?.toString(),
        longitude: data.longitude?.toString(),
      });
      return response.json();
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/meters"] });
      if (hasNext) {
        goToNextMeter();
      } else {
        Alert.alert("تم الحفظ", "تم حفظ جميع القراءات", [
          { text: "حسناً", onPress: () => navigation.goBack() },
        ]);
      }
    },
    onError: async (error) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "حدث خطأ أثناء حفظ القراءة");
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (data: { skipReason: string; latitude?: number; longitude?: number }) => {
      const response = await apiRequest("POST", "/api/readings", {
        meterId: meter.id,
        readerId: meter.readerId,
        skipReason: data.skipReason,
        latitude: data.latitude?.toString(),
        longitude: data.longitude?.toString(),
      });
      return response.json();
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/meters"] });
      goToNextMeter();
    },
    onError: async (error) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "حدث خطأ أثناء حفظ السبب");
    },
  });

  const resetForm = () => {
    setNewReading("");
    setNotes("");
    setPhotoUri(null);
    setOtherReason("");
  };

  const goToNextMeter = () => {
    if (hasNext) {
      const nextMeter = allMeters[currentIndex + 1];
      resetForm();
      navigation.replace("ReadingEntry", {
        meter: nextMeter,
        allMeters,
        currentIndex: currentIndex + 1,
      });
    } else {
      navigation.goBack();
    }
  };

  const goToPreviousMeter = () => {
    if (hasPrevious) {
      const prevMeter = allMeters[currentIndex - 1];
      resetForm();
      navigation.replace("ReadingEntry", {
        meter: prevMeter,
        allMeters,
        currentIndex: currentIndex - 1,
      });
    }
  };

  const handleNextPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!newReading.trim() && !isCompleted) {
      setShowSkipModal(true);
    } else {
      goToNextMeter();
    }
  };

  const handlePreviousPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToPreviousMeter();
  };

  const handleSkipWithReason = async (reason: string) => {
    const reasonLabel = reason === "other" ? otherReason : SKIP_REASONS.find(r => r.id === reason)?.label || reason;
    if (reason === "other" && !otherReason.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال السبب");
      return;
    }
    setShowSkipModal(false);

    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }
    } catch (error) {
      console.log("Could not get location:", error);
    }

    const readingId = Math.random().toString(36).substring(7);
    const savedLocally = await saveReadingToLocalDB(
      readingId,
      meter.id,
      meter.readerId,
      null,
      "",
      "",
      undefined,
      reasonLabel,
      latitude,
      longitude
    );

    if (savedLocally) {
      // Optimistic update
      queryClient.setQueryData(['/api/meters', meter.readerId], (oldData: any) => {
        if (oldData && Array.isArray(oldData)) {
          return oldData.map((m: any) => 
            m.id === meter.id 
              ? { 
                  ...m, 
                  latestReading: {
                    id: readingId,
                    newReading: null,
                    createdAt: new Date().toISOString(),
                    readingDate: new Date().toISOString(),
                    meterId: meter.id,
                    readerId: meter.readerId,
                    photoPath: null,
                    notes: null,
                    skipReason: reasonLabel,
                    isCompleted: true,
                    latitude: latitude?.toString() || null,
                    longitude: longitude?.toString() || null
                  }
                }
              : m
          );
        }
        return oldData;
      });

      Alert.alert("تم الحفظ محلياً", "تم حفظ سبب التخطي محلياً وسيتم مزامنته لاحقاً عند الضغط على زر المزامنة.", [
        { text: "حسناً", onPress: () => goToNextMeter() }
      ]);
    } else {
      Alert.alert("خطأ", "فشل الحفظ محلياً.");
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
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

  const savePhotoToGallery = async (uri: string, fileName: string): Promise<boolean> => {
    try {
      if (Platform.OS === "web") {
        return true;
      }

      if (!mediaLibraryPermission?.granted) {
        const { granted } = await requestMediaLibraryPermission();
        if (!granted) {
          console.log("Media library permission not granted");
          return false;
        }
      }

      // حفظ الصورة في معرض الجهاز
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      const albumName = "قراءات الكهرباء";
      let album = await MediaLibrary.getAlbumAsync(albumName);
      
      if (!album) {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
      
      console.log(`Photo saved to album '${albumName}'. Reference name: ${fileName}`);
      return true;
    } catch (error) {
      console.error("Error saving photo to gallery:", error);
      return false;
    }
  };


  const handleSave = async () => {
    if (!newReading.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("تنبيه", "يرجى إدخال القراءة الجديدة");
      return;
    }

    if (!photoUri) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("تنبيه", "يجب التقاط صورة للمقياس قبل حفظ القراءة");
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
      Alert.alert("تنبيه", "لا يمكن إدخال قراءة أقل من القراءة السابقة");
      return;
    }

    setIsSaving(true);

    const timestamp = Date.now();
    // Ensure filename is safe and properly formatted
    const safeAccountNumber = meter.accountNumber.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSequence = meter.sequence.replace(/[^a-zA-Z0-9]/g, '_');
    const photoFileName = `${safeAccountNumber}_${safeSequence}_${timestamp}.jpg`;
    
    console.log('Generated photo filename:', photoFileName);

    let latitude: number | undefined;
    let longitude: number | undefined;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }
    } catch (error) {
      console.log("Could not get location:", error);
    }

    // حفظ الصورة في معرض الجهاز فقط - بدون رفع للخادم
    if (photoUri) {
      await savePhotoToGallery(photoUri, photoFileName);
    }
    
    // حفظ القراءة محلياً في SQLite (strictly offline per user request)
    const readingId = Math.random().toString(36).substring(7);
    const savedLocally = await saveReadingToLocalDB(
      readingId,
      meter.id,
      meter.readerId,
      readingValue,
      photoUri || "",
      photoFileName,
      notes.trim() || undefined,
      undefined,
      latitude,
      longitude
    );

    if (!savedLocally) {
      setIsSaving(false);
      Alert.alert("خطأ", "فشل الحفظ المحلي في قاعدة البيانات.");
      return;
    }

    setIsSaving(false);
    
    // تحديث حالة المتر محلياً ليعكس أنه تم قراءته
    queryClient.setQueryData(['/api/meters', meter.readerId], (oldData: any) => {
      if (oldData && Array.isArray(oldData)) {
        return oldData.map((m: any) => 
          m.id === meter.id 
            ? { 
                ...m, 
                latestReading: {
                  id: readingId,
                  newReading: readingValue,
                  createdAt: new Date().toISOString(),
                  readingDate: new Date().toISOString(),
                  meterId: meter.id,
                  readerId: meter.readerId,
                  photoPath: photoFileName,
                  notes: notes.trim() || null,
                  skipReason: null,
                  isCompleted: true,
                  latitude: latitude?.toString() || null,
                  longitude: longitude?.toString() || null
                }
              }
            : m
        );
      }
      return oldData;
    });
    
    // منع إعادة التحميل التلقائي للحفاظ على الحالة المحلية
    queryClient.cancelQueries({ queryKey: ['/api/meters', meter.readerId] });
    
    // إظهار رسالة تؤكد الحفظ المحلي والانتظار للمزامنة اليدوية
    Alert.alert("تم الحفظ محلياً", "تم حفظ القراءة والصورة محلياً بنجاح.\nيرجى المزامنة يدوياً من قائمة المشتركين عند توفر الإنترنت.", [
      { text: "حسناً", onPress: () => goToNextMeter() }
    ]);
  };

  const canSave = newReading.trim().length > 0 && photoUri !== null;

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={(ref) => setCameraRef(ref)}
          style={styles.camera}
          facing="back"
        />
        {/* Overlay content positioned absolutely */}
        <View style={styles.cameraOverlay} pointerEvents="box-none">
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
        <View style={[styles.subscriberHeader, { backgroundColor: AppColors.primary }]}>
          <ThemedText style={styles.subscriberName}>
            {meter.subscriberName}
          </ThemedText>
          <ThemedText style={styles.accountNumberHeader}>
            {meter.accountNumber}
          </ThemedText>
        </View>

        <View style={[styles.meterInfoCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                الصنف
              </ThemedText>
              <ThemedText style={styles.infoValue}>
                {meter.category}
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
          </View>

          <View style={styles.addressSection}>
            <ThemedText style={[styles.addressLabel, { color: theme.textSecondary }]}>
              العنوان
            </ThemedText>
            <View style={styles.addressRow}>
              <View style={styles.addressItem}>
                <ThemedText style={[styles.addressItemLabel, { color: theme.textSecondary }]}>سجل</ThemedText>
                <ThemedText style={styles.addressItemValue}>{meter.record}</ThemedText>
              </View>
              <View style={styles.addressItem}>
                <ThemedText style={[styles.addressItemLabel, { color: theme.textSecondary }]}>بلوك</ThemedText>
                <ThemedText style={styles.addressItemValue}>{meter.block}</ThemedText>
              </View>
              <View style={styles.addressItem}>
                <ThemedText style={[styles.addressItemLabel, { color: theme.textSecondary }]}>عقار</ThemedText>
                <ThemedText style={styles.addressItemValue}>{meter.property}</ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.previousReadingSection, { borderTopColor: theme.border }]}>
            <View style={styles.previousReadingInfo}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                القراءة السابقة
              </ThemedText>
              <ThemedText style={[styles.previousReadingValue, { color: AppColors.primary }]}>
                {meter.previousReading.toLocaleString("ar-IQ")}
              </ThemedText>
            </View>
            <View style={styles.previousReadingInfo}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                التاريخ
              </ThemedText>
              <ThemedText style={styles.previousReadingDate}>
                {formatDate(meter.previousReadingDate)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.financialCard, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText style={styles.financialTitle}>المبالغ المستحقة</ThemedText>
          <View style={styles.financialRow}>
            <View style={styles.financialItem}>
              <ThemedText style={[styles.financialLabel, { color: theme.textSecondary }]}>
                المبلغ الحالي
              </ThemedText>
              <ThemedText style={styles.financialValue}>
                {Number(meter.currentAmount).toLocaleString("ar-IQ")} د.ع
              </ThemedText>
            </View>
            <View style={styles.financialItem}>
              <ThemedText style={[styles.financialLabel, { color: theme.textSecondary }]}>
                الديون
              </ThemedText>
              <ThemedText style={[styles.financialValue, { color: AppColors.error }]}>
                {Number(meter.debts).toLocaleString("ar-IQ")} د.ع
              </ThemedText>
            </View>
          </View>
          <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
            <ThemedText style={styles.totalLabel}>المجموع</ThemedText>
            <ThemedText style={[styles.totalValue, { color: AppColors.primary }]}>
              {Number(meter.totalAmount).toLocaleString("ar-IQ")} د.ع
            </ThemedText>
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
            <AnimatedPressable
              onPress={handleTakePhoto}
              style={[
                styles.cameraButton,
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
            disabled={!canSave || mutation.isPending || isSaving}
            style={[
              styles.saveButton,
              {
                backgroundColor: canSave ? AppColors.primary : theme.pending,
                opacity: (mutation.isPending || isSaving) ? 0.7 : 1,
              },
            ]}
            testID="button-save"
          >
            {(mutation.isPending || isSaving) ? (
              <View style={styles.savingIndicator}>
                <ActivityIndicator color="#FFFFFF" />
                <ThemedText style={styles.saveButtonText}>
                  {isSaving ? "جاري الحفظ..." : "حفظ القراءة"}
                </ThemedText>
              </View>
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

        <View style={styles.navigationSection}>
          <View style={styles.meterCounter}>
            <ThemedText style={[styles.counterText, { color: theme.textSecondary }]}>
              {currentIndex + 1} / {allMeters.length}
            </ThemedText>
          </View>
          <View style={styles.navigationButtons}>
            <Pressable
              onPress={handleNextPress}
              disabled={skipMutation.isPending}
              style={[
                styles.navButton,
                { backgroundColor: hasNext ? AppColors.accent : theme.pending },
              ]}
              testID="button-next"
            >
              {skipMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <ThemedText style={styles.navButtonText}>
                    {hasNext ? "التالي" : "إنهاء"}
                  </ThemedText>
                  <Feather name="arrow-left" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>
            <Pressable
              onPress={handlePreviousPress}
              disabled={!hasPrevious}
              style={[
                styles.navButton,
                { backgroundColor: hasPrevious ? theme.backgroundSecondary : theme.pending },
              ]}
              testID="button-previous"
            >
              <Feather name="arrow-right" size={20} color={hasPrevious ? theme.text : theme.textSecondary} />
              <ThemedText style={[styles.navButtonText, { color: hasPrevious ? theme.text : theme.textSecondary }]}>
                السابق
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSkipModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3" style={styles.modalTitle}>
                سبب عدم القراءة
              </ThemedText>
              <Pressable onPress={() => setShowSkipModal(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              يرجى اختيار سبب عدم قراءة العداد
            </ThemedText>
            
            <View style={styles.reasonsList}>
              {SKIP_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  onPress={() => reason.id !== "other" && handleSkipWithReason(reason.id)}
                  style={[
                    styles.reasonButton,
                    { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                  ]}
                >
                  <ThemedText style={styles.reasonText}>{reason.label}</ThemedText>
                  {reason.id !== "other" && (
                    <Feather name="chevron-left" size={20} color={theme.textSecondary} />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.otherReasonSection}>
              <TextInput
                style={[styles.otherReasonInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="أو اكتب سبباً آخر..."
                placeholderTextColor={theme.textSecondary}
                value={otherReason}
                onChangeText={setOtherReason}
              />
              {otherReason.trim().length > 0 ? (
                <Pressable
                  onPress={() => handleSkipWithReason("other")}
                  style={[styles.submitOtherButton, { backgroundColor: AppColors.accent }]}
                >
                  <ThemedText style={styles.submitOtherText}>إرسال</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
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
  subscriberHeader: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  subscriberName: {
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  accountNumberHeader: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  meterInfoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row-reverse",
    marginBottom: Spacing.md,
  },
  infoItem: {
    flex: 1,
    alignItems: "flex-end",
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  infoValue: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "right",
    writingDirection: "rtl",
  },
  addressSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addressLabel: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: Spacing.sm,
  },
  addressRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  addressItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  addressItemLabel: {
    fontSize: 11,
    fontFamily: "Cairo_400Regular",
  },
  addressItemValue: {
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
  },
  previousReadingSection: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  previousReadingInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  previousReadingValue: {
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  previousReadingDate: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  financialCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  financialTitle: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
    marginBottom: Spacing.md,
  },
  financialRow: {
    flexDirection: "row-reverse",
    marginBottom: Spacing.md,
  },
  financialItem: {
    flex: 1,
    alignItems: "flex-end",
  },
  financialLabel: {
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    marginBottom: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  financialValue: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "right",
    writingDirection: "rtl",
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: Spacing.md,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
  },
  totalValue: {
    fontSize: 20,
    fontFamily: "Cairo_700Bold",
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontFamily: "Cairo_600SemiBold",
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
  cameraButton: {
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
  savingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  navigationSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  meterCounter: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  counterText: {
    fontSize: 14,
    fontFamily: "Cairo_600SemiBold",
  },
  navigationButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  navButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontFamily: "Cairo_700Bold",
  },
  modalCloseButton: {
    padding: Spacing.xs,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Cairo_400Regular",
    marginBottom: Spacing.lg,
  },
  reasonsList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  reasonButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
  },
  otherReasonSection: {
    gap: Spacing.sm,
  },
  otherReasonInput: {
    height: 50,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: "Cairo_400Regular",
    textAlign: "right",
  },
  submitOtherButton: {
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: BorderRadius.md,
  },
  submitOtherText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Cairo_600SemiBold",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    pointerEvents: "none",
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
