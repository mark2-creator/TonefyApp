import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity } from 'react-native';
import DashboardScreen from './DashboardScreen';
import MyVideosScreen from './MyVideosScreen';
import CalendarScreen from './CalendarScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: focused ? '#2ecc71' : '#666' }}>{label}</Text>
    </View>
  );
}

function EmptyScreen() {
  return null;
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: '#111', borderTopColor: '#2a2a2a', height: 80, paddingTop: 8 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="MyVideos"
        component={MyVideosScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🎬" label="Videos" focused={focused} /> }}
      />
      <Tab.Screen
        name="CreateTab"
        component={EmptyScreen}
        options={({ navigation }) => ({
          tabBarButton: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('IdeaToVideo')}
              style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 30, color: '#2ecc71', fontWeight: '300' }}>+</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Calendar" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
