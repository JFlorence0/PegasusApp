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
  const [menuItemsLoading, setMenuItemsLoading] = useState(false);
  const [displayedMenuItems, setDisplayedMenuItems] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [menus, setMenus] = useState([]);

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
    // Keep only the latest 100 orders if the number exceeds 100
    const limitedOrders = orders.slice(0, 100);

    setRestaurantOrders(limitedOrders);
  
    // Save to AsyncStorage
    await AsyncStorage.setItem('restaurantOrders', JSON.stringify(limitedOrders));
  };  

  const restaurantLogin = async (username, password, venueId) => {
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

  const getMenuItems = async (venue) => {
    if (!venue || !venue.id) {
        return null;
    }
    setMenuItemsLoading(true);
    try {
        const res = await axios.get(`${MOBYLMENU_API_BASE_URL}/get_menu_items/${venue.id}/`);
        const response = res.data;

        // Transform the response into a JSON object with item IDs as keys
        const transformedMenuItems = response.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {});

        setMenuItemsLoading(false);
        setDisplayedMenuItems(transformedMenuItems);
        return transformedMenuItems;
    } catch (err) {
        console.log(`Error getting menuItems: ${err}`);
        setMenuItemsLoading(false);
        return null;
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

const updateOrderStatus = (orderId, newStatus, declineNote = '') => {

  fetch(`${MOBYLMENU_API_BASE_URL}/orders/status/${orderId}/`, {
      method: 'PATCH',
      headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${restaurantInfo?.token}`,
      },
      body: JSON.stringify({ status: newStatus, decline_note: declineNote }),
  })
  .then((response) => {
      if (!response.ok) {
          console.error('Failed to update order status');
      }
  })
  .catch((error) => console.error('Error updating order status:', error));

  // Update local state and then update AsyncStorage
  setRestaurantOrders((prevOrders) => {
      const updatedOrders = prevOrders.map((order) =>
          order.id === orderId
              ? { ...order, status: newStatus, decline_note: newStatus === 'declined' ? declineNote : '' }
              : order
      );

      // Update AsyncStorage after the state update
      updateAsyncStorageOrders(updatedOrders);

      return updatedOrders;
  });
};

const createMenuItem = async (menuItemData, menu) => {
  try {
    // Add the menu ID to the FormData
    menuItemData.append('menu', menu);

    console.log('Data being sent for new menu item:', menuItemData);

    const res = await axios.post(
      `${MOBYLMENU_API_BASE_URL}/menu_item/`,
      menuItemData,
      {
        headers: {
          Authorization: `Token ${restaurantInfo?.token}`, // Add the token here
          'Content-Type': 'multipart/form-data', // Ensure correct content type
        },
      }
    );

    const newItem = res.data;

    // Update displayedMenuItems with the new item
    setDisplayedMenuItems((prevItems) => ({
      ...prevItems,
      [newItem.id]: newItem,
    }));

    return newItem;
  } catch (error) {
    console.error('Error creating menu item:', error);
    throw error;
  }
};

  const updateMenuItem = async (menuItemId, formData) => {
    try {
  
      // Omit 'picture' and 'picture_compressed' fields if they are URLs
      if (formData.get('picture') && typeof formData.get('picture') === 'string' && formData.get('picture').startsWith('http')) {
        formData.delete('picture'); // Remove the field from formData
      }
  
      if (formData.get('picture_compressed') && typeof formData.get('picture_compressed') === 'string' && formData.get('picture_compressed').startsWith('http')) {
        formData.delete('picture_compressed'); // Remove the field from formData
      }
  
      // Send the processed formData to the backend
      const res = await axios.put(
        `${MOBYLMENU_API_BASE_URL}/menu_item/${menuItemId}/`,
        formData, // Send the formData directly
        {
          headers: {
            Authorization: `Token ${restaurantInfo?.token}`,
            'Content-Type': 'multipart/form-data', // Ensure the correct content type
          },
        }
      );
  
      const updatedItem = res.data;
  
      // Update displayedMenuItems with the updated item
      setDisplayedMenuItems((prevItems) => ({
        ...prevItems,
        [updatedItem.id]: updatedItem, // Replace the existing item with the updated one
      }));
  
      return updatedItem;
    } catch (error) {
      console.error('Error updating menu item:', error);
      throw error;
    }
  };
  
const deleteMenuItem = async (menuItemId) => {
    try {
      await axios.delete(
        `${MOBYLMENU_API_BASE_URL}/menu_item/${menuItemId}/`,
        {
          headers: {
            Authorization: `Token ${restaurantInfo?.token}`, // Add the token here
          },
        }
      );

      // Remove the item from displayedMenuItems
      setDisplayedMenuItems((prevItems) => {
        const updatedItems = { ...prevItems };
        delete updatedItems[menuItemId];
        return updatedItems;
      });
    } catch (error) {
      console.error('Error deleting menu item:', error);
      throw error;
    }
  };

  const getOtherMenus = async (venue) => {
    if (!venue || !venue.id) {
        return null;
    }
    
    try {
        const res = await axios.get(`${MOBYLMENU_API_BASE_URL}/other_menus/${venue.id}`);
        const response = res.data;
        return response;
    } catch (err) {
        console.log(`Error getting other menus: ${err}`);
        return null;
    }
  };

  const getOtherMenuItems = async (menu) => {
    if (!menu || !menu.id) {
        console.log('Menu or menu ID not provided');
        return null;
    }
    
    try {
        const res = await axios.get(`${MOBYLMENU_API_BASE_URL}/other_menu_items/${menu.id}`);
        const response = res.data;
        // Transform the response into a JSON object with item IDs as keys
        const transformedMenuItems = response.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
      }, {});

      setDisplayedMenuItems(transformedMenuItems);
      return transformedMenuItems;
    } catch (err) {
        console.log(`Error getting other menu items: ${err}`);
        return null;
    }
  };

const createMenu = async (formData) => {
  try {
    const response = await axios.post(`${MOBYLMENU_API_BASE_URL}/menu/`, formData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${restaurantInfo?.token}`,
      },
    });

    const newMenu = response.data;
    // Append the new menu to the menus list
    setMenus([...menus, newMenu]); // Adds the new menu at the end
    return newMenu;
  } catch (error) {
    console.error("Error creating menu:", error.response?.data || error.message);
    throw error;
  }
};

const updateMenu = async (menuId, formData) => {
  try {
    const response = await axios.put(`${MOBYLMENU_API_BASE_URL}/menu/${menuId}/`, formData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${restaurantInfo?.token}`,
      },
    });

    const updatedMenu = response.data;
    // Replace the updated menu in the menus list
    setMenus(
      menus.map((menu) => (menu.id === menuId ? updatedMenu : menu)) // Replaces the matching menu
    );
    return updatedMenu;
  } catch (error) {
    console.error("Error updating menu:", error.response?.data || error.message);
    throw error;
  }
};

const deleteMenu = async (menuId) => {
  try {
    await axios.delete(`${MOBYLMENU_API_BASE_URL}/menu/${menuId}/`);
    // Remove the deleted menu from the list
    setMenus(menus.filter((menu) => menu.id !== menuId));
    console.log("Menu deleted successfully.");
  } catch (error) {
    console.error("Error deleting menu:", error.response?.data || error.message);
    throw error;
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
      restaurantOrders,
      setRestaurantOrders,
      updateAsyncStorageOrders,
      updateOrderStatus,
      getMenuItems,
      displayedMenuItems,
      createMenuItem,
      updateMenuItem,
      deleteMenuItem,
      getOtherMenus,
      getOtherMenuItems,
      createMenu,
      updateMenu,
      menus,
      setMenus,
      deleteMenu
       }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurantAuth = () => useContext(RestaurantContext);