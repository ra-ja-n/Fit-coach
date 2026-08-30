import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ClientStackParamList, ClientTabsParamList } from './types';
import { request } from '../lib/api/api';
import { C } from '../theme/tokens';
import HomeScreen from '../screens/client/HomeScreen';
import ProgressScreen from '../screens/client/ProgressScreen';
import ChatTabScreen from '../screens/client/ChatTabScreen';
import ProfileScreen from '../screens/client/ProfileScreen';
import PlanScreen from '../screens/client/PlanScreen';
import CoachDetailScreen from '../screens/client/CoachDetailScreen';
import CheckoutScreen from '../screens/client/CheckoutScreen';
import BrowseScreen from '../screens/client/BrowseScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import PhotoViewScreen from '../screens/shared/PhotoViewScreen';

const Tab = createBottomTabNavigator<ClientTabsParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();

function ClientTabs() {
  const { data: summary } = useQuery({
    queryKey: ['chat', 'clientSummary'],
    queryFn: () => request<{ hasThread: boolean; unread: number; coachId: string | null }>('chat.clientSummary'),
  });
  const unread = summary?.unread ?? 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.faint,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line, height: 62, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<keyof ClientTabsParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Home: ['home', 'home-outline'],
            Progress: ['trending-up', 'trending-up-outline'],
            ChatTab: ['chatbubble', 'chatbubble-outline'],
            Profile: ['person', 'person-outline'],
          };
          const [on, off] = icons[route.name as keyof ClientTabsParamList] ?? ['ellipse', 'ellipse-outline'];
          const icon = (
            <Ionicons name={focused ? on : off} size={size} color={color} />
          );
          if (route.name === 'ChatTab' && unread > 0) {
            return (
              <View>
                {icon}
                <View style={{ position: 'absolute', top: -3, right: -8, backgroundColor: C.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              </View>
            );
          }
          return icon;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="ChatTab" component={ChatTabScreen} options={{ title: 'Chat' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={ClientTabs} />
      <Stack.Screen name="Plan" component={PlanScreen} />
      <Stack.Screen name="CoachDetail" component={CoachDetailScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Browse" component={BrowseScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="PhotoView" component={PhotoViewScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
