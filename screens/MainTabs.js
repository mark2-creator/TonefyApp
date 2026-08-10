import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from './DashboardScreen';
import MyVideosScreen from './MyVideosScreen';
import CalendarScreen from './CalendarScreen';
import ProfileScreen from './ProfileScreen';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

function EmptyScreen() {
  return null;
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.icon,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: theme.settingBg,
          borderTopColor: theme.border,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom || 8,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyVideos"
        component={MyVideosScreen}
        options={{
          tabBarLabel: 'Videos',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'videocam' : 'videocam-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CreateTab"
        component={EmptyScreen}
        options={({ navigation }) => ({
          tabBarLabel: '',
          tabBarIcon: () => (
            <Text style={{ fontSize: 26, color: theme.accent, fontWeight: '300', lineHeight: 30 }}>+</Text>
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...props}
              onPress={() => navigation.navigate('IdeaToVideo')}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            />
          ),
        })}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
