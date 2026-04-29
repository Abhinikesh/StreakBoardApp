import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';

import LoginScreen       from '../screens/LoginScreen';
import DashboardScreen   from '../screens/DashboardScreen';
import CalendarScreen    from '../screens/CalendarScreen';
import StatsScreen       from '../screens/StatsScreen';
import FriendsScreen     from '../screens/FriendsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import { useTheme, DARK } from '../context/ThemeContext';
import SplashScreen from '../screens/SplashScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const TABS = [
  { name: 'Home',     label: 'Home',    emoji: '🏠', component: DashboardScreen },
  { name: 'Calendar', label: 'Calendar',emoji: '📅', component: CalendarScreen },
  { name: 'Stats',    label: 'Stats',   emoji: '📊', component: StatsScreen },
  { name: 'Friends',  label: 'Friends', emoji: '👥', component: FriendsScreen },
  { name: 'Ranks',    label: 'Ranks',   emoji: '🏆', component: LeaderboardScreen },
  { name: 'Profile',  label: 'Profile', emoji: '👤', component: ProfileScreen },
];

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          height:          70,
          paddingBottom:   10,
          paddingTop:      6,
          position:        'absolute',
          bottom: 0, left: 0, right: 0,
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarIconStyle:  { marginBottom: 0 },
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
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main"  component={MainTabs} />
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
        setStatus(token ? 'main' : 'auth');
      } catch (_) {
        setStatus('auth');
      }
    })();
  }, []);

  if (status === 'loading') return <LoadingScreen />;

  return (
    <NavigationContainer>
      <RootStack initialRoute={status === 'main' ? 'Main' : 'Login'} />
    </NavigationContainer>
  );
}
