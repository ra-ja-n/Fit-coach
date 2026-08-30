import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { CoachStackParamList, CoachTabsParamList } from './types';
import { request } from '../lib/api/api';
import type { ChatThreadRow } from '../lib/api/types';
import { C } from '../theme/tokens';
import CoachHomeScreen from '../screens/coach/CoachHomeScreen';
import MessagesScreen from '../screens/coach/MessagesScreen';
import CoachProfileScreen from '../screens/coach/CoachProfileScreen';
import ClientDetailScreen from '../screens/coach/ClientDetailScreen';
import PlanBuilderScreen from '../screens/coach/PlanBuilderScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import PhotoViewScreen from '../screens/shared/PhotoViewScreen';

const Tab = createBottomTabNavigator<CoachTabsParamList>();
const Stack = createNativeStackNavigator<CoachStackParamList>();

function CoachTabs() {
  const { data: threads } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => request<ChatThreadRow[]>('chat.threads'),
  });
  const unread = (threads ?? []).reduce((a, t) => a + t.unread, 0);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.faint,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.line, height: 62, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<keyof CoachTabsParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Clients: ['people', 'people-outline'],
            Messages: ['chatbubble', 'chatbubble-outline'],
            CoachProfile: ['briefcase', 'briefcase-outline'],
          };
          const [on, off] = icons[route.name as keyof CoachTabsParamList] ?? ['ellipse', 'ellipse-outline'];
          const icon = <Ionicons name={focused ? on : off} size={size} color={color} />;
          if (route.name === 'Messages' && unread > 0) {
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
      <Tab.Screen name="Clients" component={CoachHomeScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="CoachProfile" component={CoachProfileScreen} options={{ title: 'Business' }} />
    </Tab.Navigator>
  );
}

export default function CoachNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={CoachTabs} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="PlanBuilder" component={PlanBuilderScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="PhotoView" component={PhotoViewScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
