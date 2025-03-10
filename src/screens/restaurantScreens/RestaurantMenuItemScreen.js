import React, { useState, useEffect } from 'react';
import { View, SafeAreaView, Text, TextInput, FlatList,
  StyleSheet, Image, TouchableOpacity, Dimensions, ScrollView, 
  Pressable} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRestaurantAuth } from '../../context/RestaurantContext';
import CustomHeader from '../../components/helperComponents/CustomHeader';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/buttons/Button';
import CustomizationForm from '../../components/helperComponents/CustomizationForm';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { PageContainer, PageBody } from "../../components/helperComponents/PageElements";
import { Colors } from '../../styles/Constants';

const RestaurantMenuItemScreen = ({ route, navigation }) => {
  const { menuItem, venue, categories } = route.params || {};
  const { createMenuItem, updateMenuItem } = useRestaurantAuth(); // Include your API functions
  const [name, setName] = useState(menuItem?.name || '');
  const [description, setDescription] = useState(menuItem?.description || '');
  const [price, setPrice] = useState(menuItem?.price || '');
  const [imageUri, setImageUri] = useState(menuItem?.picture || '');
  const [itemType, setItemType] = useState(menuItem?.item_type || '');
  const [filteredCategories, setFilteredCategories] = useState(categories || []); // Filtered list of categories
  const [showDropdown, setShowDropdown] = useState(false);
  const [customizableContainerVisible, setCustomizableContainerVisible] = useState(
    menuItem?.customization_groups && menuItem.customization_groups.length > 0
  );  
  const [isFormValid, setIsFormValid] = useState(false);
  const nav = useNavigation();

  const [groups, setGroups] = useState(() => {
    if (menuItem?.customization_groups && menuItem.customization_groups.length > 0) {
      return menuItem.customization_groups.map(group => ({
        id: group.id || null, // Do not assign a default value if `id` is not present
        name: group.name || "",
        required: group.required || false,
        minSelections: group.min_selections || 1,
        maxSelections: group.max_selections || 1,
        options: group.options.map(option => ({
          id: option.id || null, // Do not assign a default value if `id` is not present
          name: option.name || "",
          priceModifier: option.price_modifier || "",
          description: option.description || "",
        })),
      }));
    }
  
    // For new items, initialize without IDs
    return [
      {
        id: null, // No ID for new group
        name: "",
        required: false,
        minSelections: 1,
        maxSelections: 1,
        options: [],
      },
    ];
  });
  

  // Dietary options state
  const [dietaryOptions, setDietaryOptions] = useState({
    vegan: menuItem?.vegan || false,
    vegan_option: menuItem?.vegan_option || false,
    vegetarian: menuItem?.vegetarian || false,
    vegetarian_option: menuItem?.vegetarian_option || false,
    gluten_free: menuItem?.gluten_free || false,
    gluten_free_option: menuItem?.gluten_free_option || false,
    spicy: menuItem?.spicy || false,
    contains_nuts: menuItem?.contains_nuts || false,
    contains_alcohol: menuItem?.contains_alcohol || false,
  });

  const validatePrice = (value) => {
    return /^(\d+(\.\d{1,2})?)$/.test(value); // Validates number with up to 2 decimal places
  };

  const validateName = (value) => {
    return value.length > 0 && value.length <= 50; // Ensures length is between 1 and 50
  };

  const validateCategory = (value) => {
    return value.length > 0 && value.length <= 25; // Ensures length is between 1 and 25
  };

  // Recalculate form validity whenever inputs change
  useEffect(() => {
    const isValid =
      validateName(name) && validatePrice(price) && validateCategory(itemType);
    setIsFormValid(isValid);
  }, [name, price, itemType]);

  const toggleCustomizableContainerVisible = () => {
    setCustomizableContainerVisible(!customizableContainerVisible);
  }

  const handleCategoryInputChange = (value) => {
    setItemType(value);
  
    if (value) {
      const matchingCategories = categories && categories.length
        ? categories.filter((cat) =>
            cat.toLowerCase().includes(value.toLowerCase())
          )
        : [];
      setFilteredCategories(matchingCategories);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };
  

  const handleCategorySelect = (category) => {
    setItemType(category);
    setShowDropdown(false);
  };

  const handleSave = async () => {
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('item_type', itemType);
  
      // Append the selected image
      if (imageUri && !imageUri.startsWith('http')) {
        const sanitizedFileName = name.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const fileName = `${sanitizedFileName}.jpg`;
  
        formData.append('picture', {
          uri: imageUri,
          name: fileName,
          type: 'image/jpeg',
        });
      }
  
      // Validate and append groups (customizations)
      const validGroups = groups.filter(group => group.name && group.options.length > 0);
  
      if (validGroups.length > 0) {
        formData.append(
          "customizations",
          JSON.stringify(
            validGroups.map(group => ({
              ...(group.id ? { id: group.id } : {}), // Only include ID if it exists
              name: group.name,
              required: group.required,
              min_selections: group.minSelections,
              max_selections: group.maxSelections,
              options: group.options.map(option => ({
                ...(option.id ? { id: option.id } : {}), // Only include ID if it exists
                name: option.name,
                price_modifier: option.priceModifier,
                description: option.description,
              })),
            }))
          )
        );
      }
  
      // Append dietary options
      Object.entries(dietaryOptions).forEach(([key, value]) => {
        formData.append(key, value);
      });
  
      if (menuItem) {
        // Update existing item
        await updateMenuItem(menuItem.id, formData);
      } else {
        // Create new item
        await createMenuItem(formData, venue?.menu?.id);
        console.log('Created new menu item:', { name, description, price, dietaryOptions, imageUri });
      }
  
      navigation.goBack();
    } catch (error) {
      console.error('Error saving menu item:', error);
    }
  };  


  const toggleDietaryOption = (key) => {
    setDietaryOptions((prevOptions) => ({
      ...prevOptions,
      [key]: !prevOptions[key],
    }));
  };

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      // Replace the current image with the new selection
      setImageUri(result.assets[0].uri);
    }
  };

  return (
    <PageContainer>
      {/* Static Header */}
      <CustomHeader
        title={venue?.venue_name}
      />
      <PageBody>
        <KeyboardAwareScrollView
          style={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true} // Ensures it works on Android
          extraHeight={100} // Adjust this value if needed
        >
          
            <Text style={[styles.label]}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
            />
  
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              multiline
            />
  
            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="Enter price"
              keyboardType="numeric"
            />
  
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={[styles.input, {marginBottom: 0}]}
              value={itemType}
              onChangeText={handleCategoryInputChange}
              placeholder="Type or select a category"
            />
            {showDropdown && (
              <View style={styles.dropdownContainer}>
                {filteredCategories.map((item, index) => (
                  <TouchableOpacity
                    key={`${item}-${index}`}
                    onPress={() => handleCategorySelect(item)}
                    style={styles.dropdownItem}
                  >
                    <Text style={styles.dropdownItemText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              )}
  
              <Text style={[styles.label, { marginTop: 20, marginBottom: 0 }]}>Image</Text>

            <View style={{ flexDirection: 'row' }}>
              {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.image} />
              )}
              <Button title="Select Image" onPress={pickImage} />
            </View>
  
            <Text style={[styles.label, { marginTop: 20 }]}>Dietary Options</Text>
            <View style={styles.checkboxOuterContainer}>
              {Object.keys(dietaryOptions)
                .reduce((rows, key, index, keys) => {
                  if (index % 2 === 0) rows.push(keys.slice(index, index + 2)); // Create chunks of 2
                  return rows;
                }, [])
                .map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.checkboxRow}>
                    {row.map((key) => (
                      <View key={key} style={styles.checkboxContainer}>
                        <TouchableOpacity
                          style={[
                            styles.checkbox,
                            dietaryOptions[key] && styles.checkboxChecked,
                          ]}
                          onPress={() => toggleDietaryOption(key)}
                        >
                          {dietaryOptions[key] && <Icon name="check" size={18} color="white" />}
                        </TouchableOpacity>
                        <Text style={styles.checkboxLabel}>{key.replace('_', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                ))}
            </View>
            <Pressable
              style={styles.customizableButtonContainer}
              onPress={() => toggleCustomizableContainerVisible()}
            >
              <Text style={styles.customizableButton}>{customizableContainerVisible ? "-" : "+"} Is this item customizable?</Text>
            </Pressable>
            {customizableContainerVisible &&
              <CustomizationForm
                groups={groups}
                setGroups={setGroups}
                maxGroupsLimit={5}
              />
            }
          <View style={styles.saveButtonContainer}>
            <Button title="Save" onPress={handleSave} disabled={!isFormValid} />
          </View>
        </KeyboardAwareScrollView>
      </PageBody>
      </PageContainer>
  );
}  

const mainColor = "#00A6FF"

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  image: {
    width: 100,
    height: 100,
    marginRight: 20
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  checkboxOuterContainer: {
    flexDirection: 'column',
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10, 
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 3,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: "#00a6ff",
    borderColor: "#00a6ff",
  },
  checkmark: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
  },
  dropdownItem: {
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#ccc",
    borderTopWidth: 0,
    padding: 10,
    borderRadius: 5,
  },
  dropdownItemText: {
    fontSize: 15
  },
  customizableButton: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600'
  },
  customizableButtonContainer: {
    marginTop: 15,
    marginBottom: 20,
  },
  saveButtonContainer: {
    marginBottom: 30,
  }
});

export default RestaurantMenuItemScreen;