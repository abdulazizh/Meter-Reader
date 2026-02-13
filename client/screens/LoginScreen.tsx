import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, AppColors } from '@/constants/theme';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { useAuth } from '@/contexts/AuthContext';
import { configService } from '@/lib/config-service';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [apiUrl, setApiUrl] = useState<string>('');
  const [isServerModalVisible, setIsServerModalVisible] = useState(false);
  const [tempServerDomain, setTempServerDomain] = useState('');
  
  React.useEffect(() => {
    getApiUrl().then(setApiUrl);
  }, []);

  const handleSaveServer = async () => {
    if (tempServerDomain.trim()) {
      await configService.updateServerDomain(tempServerDomain.trim());
      const newUrl = await getApiUrl();
      setApiUrl(newUrl);
      setIsServerModalVisible(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم الحفظ", "تم تحديث عنوان السيرفر بنجاح");
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest('POST', '/api/login', {
        username: username.trim(),
        password: password.trim(),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await login(data.reader);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('خطأ', data.error || 'فشل تسجيل الدخول');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const isNetworkError = error?.message?.includes('Network request failed') || error?.message?.includes('fetch');
      
      const errorDetails = error?.message || String(error);
      let errorMessage = `حدث خطأ في الاتصال بالخادم:\n${errorDetails}`;
      
      if (isNetworkError) {
        errorMessage = `فشل الاتصال بالسيرفر.\n\n1. تأكد أن الهاتف والكمبيوتر على نفس الشبكة.\n2. تأكد أن السيرفر يعمل.\n3. قد يكون "جدار حماية ويندوز" (Firewall) يحظر التطبيق.\n\nالرابط: ${apiUrl}\nالخطأ: ${errorDetails}`;
      }
      
      Alert.alert('خطأ في الاتصال', errorMessage);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: AppColors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.content, { paddingTop: insets.top + Spacing['3xl'] }]}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <ThemedText style={styles.title}>قراءات المشتركين</ThemedText>
          <ThemedText style={styles.subtitle}>تطبيق قراءة عدادات الكهرباء</ThemedText>
        </View>

        <View style={[styles.formContainer, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.formTitle}>تسجيل الدخول</ThemedText>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              اسم المستخدم
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="أدخل اسم المستخدم"
              placeholderTextColor={theme.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              كلمة المرور
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="أدخل كلمة المرور"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              { opacity: pressed ? 0.8 : 1 },
              isLoading && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.loginButtonText}>دخول</ThemedText>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.serverSettingsButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={async () => {
              const current = await getApiUrl();
              const domainOnly = current.replace('http://', '').replace('https://', '').replace(/\/$/, '');
              setTempServerDomain(domainOnly);
              setIsServerModalVisible(true);
            }}
          >
            <Feather name="settings" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.serverSettingsText, { color: theme.textSecondary }]}>
              إعدادات السيرفر
            </ThemedText>
          </Pressable>
        </View>

        {/* Modal for Server Settings */}
        <Modal
          visible={isServerModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsServerModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.modalTitle}>إعدادات السيرفر</ThemedText>
              <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                أدخل عنوان السيرفر (مثل IP الكمبيوتر)
              </ThemedText>
              
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                    marginTop: Spacing.md,
                  },
                ]}
                placeholder="192.168.137.1:5000"
                placeholderTextColor={theme.textSecondary}
                value={tempServerDomain}
                onChangeText={setTempServerDomain}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => setIsServerModalVisible(false)}
                >
                  <ThemedText style={{ color: theme.text }}>إلغاء</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: AppColors.primary }]}
                  onPress={handleSaveServer}
                >
                  <ThemedText style={{ color: '#fff' }}>حفظ</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <ThemedText style={styles.footerText}>
            وزارة الكهرباء - جمهورية العراق
          </ThemedText>
          <ThemedText style={[styles.footerText, { fontSize: 10, marginTop: 4, opacity: 0.5 }]}>
            v1.1 (Render Fix)
          </ThemedText>
          <ThemedText style={[styles.footerText, { fontSize: 10, marginTop: 2, opacity: 0.5 }]}>
            Server: {apiUrl}
          </ThemedText>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 70,
    height: 70,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Cairo_700Bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  formContainer: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    fontSize: 20,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
    marginBottom: Spacing.xs,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
    borderWidth: 1,
    textAlign: 'right',
  },
  loginButton: {
    backgroundColor: AppColors.primary,
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Cairo_600SemiBold',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  serverSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  serverSettingsText: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
