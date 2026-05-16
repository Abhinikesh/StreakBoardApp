import React, { useEffect, useState } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CalendarScreen from '../screens/CalendarScreen';
import StatsScreen from '../screens/StatsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import XpDetailScreen from '../screens/XpDetailScreen';
import SeasonDetailScreen from '../screens/SeasonDetailScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import WidgetInstructionsScreen from '../screens/WidgetInstructionsScreen';
import OnboardingScreen, { ONBOARDING_KEY } from '../screens/OnboardingScreen';
import SplashScreen from '../screens/SplashScreen';

export const navigationRef = createNavigationContainerRef();

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const TABS = [
  { name: 'Home',        label: 'Home',        emoji: '🏠', component: DashboardScreen },
  { name: 'Calendar',   label: 'Calendar',     emoji: '📅', component: CalendarScreen },
  { name: 'Stats',      label: 'Stats',        emoji: '📊', component: StatsScreen },
  { name: 'Friends',    label: 'Friends',      emoji: '👥', component: FriendsScreen },
  { name: 'Ranks',      label: 'Leaderboard',  emoji: '🏆', component: LeaderboardScreen },
  { name: 'Profile',    label: 'Profile',      emoji: '👤', component: ProfileScreen },
];

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:  colors.card,
          borderTopColor:   colors.border,
          borderTopWidth:   1,
          height:           Platform.OS === 'ios' ? 60 + insets.bottom : 58 + bottomInset,
          paddingBottom:    Platform.OS === 'ios' ? insets.bottom + 4  : bottomInset + 4,
          paddingTop:       6,
          position:         'absolute',
          bottom: 0, left: 0, right: 0,
          elevation:        12,
          shadowColor:      '#000',
          shadowOpacity:    0.08,
          shadowRadius:     8,
          shadowOffset:     { width: 0, height: -2 },
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize:   10,
          fontWeight: '600',
          marginTop:  2,
          marginBottom: Platform.OS === 'android' ? 2 : 0,
        },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      {TABS.map(({ name, label, emoji, component }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            tabBarLabel: label,
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 22, color }}>{emoji}</Text>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

function RootStack({ initialRoute }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animationEnabled: false }}
    >
      <Stack.Screen name="Login"               component={LoginScreen} />
      <Stack.Screen name="Main"                component={MainTabs} />
      <Stack.Screen name="XpDetail"            component={XpDetailScreen} />
      <Stack.Screen name="SeasonDetail"        component={SeasonDetailScreen} />
      <Stack.Screen name="EditProfile"         component={EditProfileScreen} />
      <Stack.Screen name="WidgetInstructions"  component={WidgetInstructionsScreen} />
      <Stack.Screen name="Onboarding"          component={OnboardingScreen} />
    </Stack.Navigator>
  );
}

function LoadingScreen() {
  return <SplashScreen />;
}

export default function AppNavigator() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) { setStatus('auth'); return; }
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY).catch(() => null);
        setStatus(onboardingDone ? 'main' : 'onboarding');
      } catch (_) {
        setStatus('auth');
      }
    })();
  }, []);

  if (status === 'loading') return <LoadingScreen />;

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack
        initialRoute={
          status === 'main'        ? 'Main'       :
          status === 'onboarding'  ? 'Onboarding' :
          'Login'
        }
      />
    </NavigationContainer>
  );
}
