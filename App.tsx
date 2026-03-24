import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>App Crashed</Text>
          <ScrollView style={eb.scroll}>
            <Text style={eb.msg}>{this.state.error.message}</Text>
            <Text style={eb.stack}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 80 },
  title: { color: '#E50914', fontSize: 24, fontWeight: '900', marginBottom: 16 },
  scroll: { flex: 1 },
  msg: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  stack: { color: '#999', fontSize: 12, lineHeight: 18 },
});

export default function App() {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
