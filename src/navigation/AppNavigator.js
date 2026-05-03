import React, { useEffect, useState, Component } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import JournalScreen       from '../screens/JournalScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import XpDetailScreen      from '../screens/XpDetailScreen';
import SeasonDetailScreen       from '../screens/SeasonDetailScreen';
import WeeklyChallengeScreen    from '../screens/WeeklyChallengeScreen';
import MessagesScreen           from '../screens/MessagesScreen';
import ConversationScreen       from '../screens/ConversationScreen';
import { useTheme, DARK } from '../context/ThemeContext';
import SplashScreen from '../screens/SplashScreen';

// ── Error Boundary: catches render errors in PublicProfileScreen ─────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🔒</Text>
          <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
            Could not load this profile. Please go back and try again.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function SafePublicProfile(props) {
  return (
    <ErrorBoundary>
      <PublicProfileScreen {...props} />
    </ErrorBoundary>
  );
}

function SafeLeaderboard(props) {
  return (
    <ErrorBoundary>
      <LeaderboardScreen {...props} />
    </ErrorBoundary>
  );
}

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const TABS = [
  { name: 'Home',     label: 'Home',    emoji: '🏠', component: DashboardScreen },
  { name: 'Calendar', label: 'Calendar',emoji: '📅', component: CalendarScreen },
  { name: 'Stats',    label: 'Stats',   emoji: '📊', component: StatsScreen },
  { name: 'Friends',  label: 'Friends', emoji: '👥', component: FriendsScreen },
  { name: 'Ranks',    label: 'Leaderboard', emoji: '🏆', component: SafeLeaderboard },
  { name: 'Profile',  label: 'Profile', emoji: '👤', component: ProfileScreen },
];

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // On Android with gesture nav, insets.bottom can be 0 but we still need
  // a minimum clearance above the gesture strip. We always add at least 8px.
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
      <Stack.Screen name="Login"         component={LoginScreen} />
      <Stack.Screen name="Main"           component={MainTabs} />
      <Stack.Screen name="Journal"        component={JournalScreen} />
      <Stack.Screen name="PublicProfile"  component={SafePublicProfile} />
      <Stack.Screen name="XpDetail"       component={XpDetailScreen} />
      <Stack.Screen name="SeasonDetail"      component={SeasonDetailScreen} />
      <Stack.Screen name="WeeklyChallenge"   component={WeeklyChallengeScreen} />
      <Stack.Screen name="Messages"          component={MessagesScreen} />
      <Stack.Screen name="Conversation"      component={ConversationScreen} />
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
