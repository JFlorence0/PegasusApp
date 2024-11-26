import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { PEGASUS_API_BASE_URL, MOBYLMENU_API_BASE_URL,
  ORS_MOBYLMENU_ROUTING_API_KEY } from '../config';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const RestaurantContext = createContext();

export const RestaurantProvider = ({ children }) => {
  const [restaurantIsLoggedIn, setRestaurantIsLoggedIn] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [selectedRole, setSelectedRole] = useState("Restaurant");
  const [restaurantIsLoggingIn, setRestaurantIsLoggingIn] = useState(null);
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [venue, setVenue] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Fetch restaurantInfo from AsyncStorage
        const storedRestaurantInfo = await AsyncStorage.getItem('restaurantInfo');
        if (storedRestaurantInfo) {
          const parsedRestaurantInfo = JSON.parse(storedRestaurantInfo);
          const savedRole = await AsyncStorage.getItem('selectedRole');
          const savedVenue = await AsyncStorage.getItem('venue');
          const savedRestaurantOrders = await AsyncStorage.getItem('restaurantOrders');
          if (savedRole) setSelectedRole(savedRole);
          if (parsedRestaurantInfo.token) {
            setRestaurantInfo(parsedRestaurantInfo);
            setRestaurantIsLoggedIn(true);
          };
          if (savedVenue) {
            const parsedSavedVenue = JSON.parse(savedVenue)
            setVenue(parsedSavedVenue);
          };
          if (savedRestaurantOrders) {
            const parsedRestaurantOrders = JSON.parse(savedRestaurantOrders)
            setRestaurantOrders(parsedRestaurantOrders);
          };

        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      }
    };

    initializeAuth();
  }, []);

  const updateAsyncStorageOrders = async (orders) => {
    // Filter only active orders (example: status is not 'closed')
    const activeOrders = orders.filter(order => order.status !== 'closed');
  
    // Keep only the latest 100 orders if the number exceeds 100
    const limitedOrders = activeOrders.slice(0, 100);

    setRestaurantOrders(limitedOrders);

    console.log('RESTAURNA', limitedOrders.length)
  
    // Save to AsyncStorage
    await AsyncStorage.setItem('restaurantOrders', limitedOrders);
  };  

  const restaurantLogin = async (username, password, venueId) => {
    console.log('TRIGGERED', username, password, venueId);
    setRestaurantIsLoggingIn(true);
  
    try {
      // Send request with the correct payload structure
      const response = await axios.post(`${MOBYLMENU_API_BASE_URL}/restaurant_login/`, {
        username,
        password,
        venue_id: venueId
      });
  
      if (response.status === 200) {
        const restaurantData = response.data;
        setRestaurantInfo(restaurantData);
  
        // Extract orders and save only active orders to AsyncStorage
        await updateAsyncStorageOrders(restaurantData.orders);
  
        setVenue(restaurantData.venue);
        await AsyncStorage.setItem('venue', JSON.stringify(restaurantData.venue));
  
        // Save other restaurant info
        await AsyncStorage.setItem('restaurantInfo', JSON.stringify(restaurantData));
        setRestaurantIsLoggedIn(true);
      } else {
        setErrorMessage("Invalid credentials. Check your email, password, and venue ID.");
      }
      setRestaurantIsLoggingIn(false);
    } catch (error) {
      setRestaurantIsLoggingIn(false);
      setErrorMessage("Invalid credentials. Check your email, password, and venue ID.");
      return;
    }
  };
  

  const restaurantLogout = async () => {
    setRestaurantIsLoggedIn(false);
    setRestaurantInfo(null);
    setRestaurantOrders([]);
    setVenue(null);

    await AsyncStorage.removeItem('restaurantInfo');
    await AsyncStorage.removeItem('selectedRole');
  };

const registerForPushNotificationsAsync = async () => {
  let token;

  // Check if the app is running on a physical device
  if (Device.isDevice) {
    // Get the current notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Handle permission denial
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notifications!');
      return null;
    }

    // Get the Expo push token
    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: 'f80cd51c-a83f-416c-9713-278a4bd014c4', // Replace with your actual Expo project ID
      })
    ).data;
  } else {
    alert('Must use a physical device for Push Notifications');
    return null;
  }

  // Set notification channel for Android
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
};

const initializePushNotifications = async () => {
  const expoPushToken = await registerForPushNotificationsAsync();

  if (expoPushToken) {
    // Update restaurantInfo with the push token
    const updatedRestaurantInfo = { ...restaurantInfo, expoPushToken };
    setRestaurantInfo(updatedRestaurantInfo);

    // Save updated restaurantInfo to AsyncStorage
    await AsyncStorage.setItem('restaurantInfo', JSON.stringify(updatedRestaurantInfo));

    // Send the push token to the backend
    await fetch(`${PEGASUS_API_BASE_URL}/drivers/update_profile/${restaurantInfo.id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expo_push_token: expoPushToken }),
    });
  }
};

  return (
    <RestaurantContext.Provider value={{ 
      restaurantIsLoggedIn, 
      restaurantIsLoggingIn,
      selectedRole,
      setSelectedRole,
      restaurantLogin, 
      restaurantLogout,
      initializePushNotifications,
      errorMessage,
      setErrorMessage,
      venue,
      restaurantOrders
       }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurantAuth = () => useContext(RestaurantContext);