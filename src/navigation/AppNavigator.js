import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SecureStore from 'expo-secure-store';

import { COLORS } from '../constants/colors';

import LoginScreen      from '../screens/LoginScreen';
import DashboardScreen  from '../screens/DashboardScreen';
import CalendarScreen   from '../screens/CalendarScreen';
import StatsScreen      from '../screens/StatsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen    from '../screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Tab icon component ───────────────────────────────────────────────────────
function TabIcon({ emoji, focused }) {
  return (
    <View style={tabIconStyles.wrapper}>
      <Text style={tabIconStyles.emoji}>{emoji}</Text>
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
});

// ─── Auth Stack ───────────────────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => {
          const icons = {
            Dashboard:   '🏠',
            Calendar:    '📅',
            Stats:       '📊',
            Leaderboard: '🏆',
            Profile:     '👤',
          };
          return <TabIcon emoji={icons[route.name]} focused={focused} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="Calendar"    component={CalendarScreen} />
      <Tab.Screen name="Stats"       component={StatsScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile"     component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Loading screen shown while token check runs ─────────────────────────────
function LoadingScreen() {
  return <View style={styles.loading} />;
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken,  setHasToken]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        setHasToken(!!token);
      } catch (_) {
        setHasToken(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      {hasToken ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  tabBar: {
    backgroundColor:  COLORS.card,
    borderTopColor:   COLORS.border,
    borderTopWidth:   1,
    paddingBottom:    6,
    paddingTop:       6,
    height:           60,
  },
  tabLabel: {
    fontSize:   10,
    marginTop:  2,
  },
});
