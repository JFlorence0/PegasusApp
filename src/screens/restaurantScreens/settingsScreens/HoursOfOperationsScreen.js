import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { settingsStyles } from '../../../styles/settingsStyles';
import { useRestaurantAuth } from '../../../context/RestaurantContext';
import TimePicker from '../../../components/helperComponents/TImePicker';
import { useNavigation } from '@react-navigation/native';

const HoursOfOperationsScreen = () => {
  const { getScheduleForVenue, venue, assignScheduleToVenue, updateScheduleForVenue } = useRestaurantAuth();
  const [schedule, setSchedule] = useState({
    Monday: { open: { hour: '', minute: '', period: '' }, close: { hour: '', minute: '', period: '' } },
    Tuesday: { open: { hour: '', minute: '', period: '' }, close: { hour: '', minute: '', period: '' } },
    Wednesday: { open: { hour: '', minute: '', period: '' }, close: { hour: '', minute: '', period: '' } },
    Thursday: { open: { hour: '', minute: '', period: '' }, close: { hour: '', minute: '', period: '' } },
    Friday: { open: { hour: '', minute: '', period: '' }, close: { hour: '', minute: '', period: '' } },
    Saturday: { open: { hour: '', minute: '', period: '' }, close: { hour: '', minute: '', period: '' } },
    Sunday: { open: { hour: '', minute: '', period: '' }, close: { hour: '', minute: '', period: '' } },
  });
  const [name, setName] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = ['00', '15', '30', '45'];
  const periods = ['AM', 'PM'];
  const nav = useNavigation();

  useEffect(() => {
    const getWeeklySchedule = async () => {
      const schedule = await getScheduleForVenue(venue?.id);
      setSelectedSchedule(schedule);
    };

    getWeeklySchedule();
  }, []);

  console.log(selectedSchedule);

  const handleChange = (day, time, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: { ...prev[day][time], [field]: value },
      },
    }));
  };

  const parseTime = (time) => {
    if (!time) return { hour: '', minute: '', period: '' };
    const [hour, minute] = time.split(':');
    const hourInt = parseInt(hour, 10);
    const period = hourInt >= 12 ? 'PM' : 'AM';
    const hour12 = hourInt % 12 || 12;
    return {
      hour: hour12.toString(),
      minute: minute,
      period: period,
    };
  };

  useEffect(() => {
    if (selectedSchedule) {
      setName(selectedSchedule.name || '');

      const updatedSchedule = { ...schedule };
      Object.keys(schedule).forEach((day) => {
        const openHr = selectedSchedule[`${day.toLowerCase()}_open_hr`];
        const closeHr = selectedSchedule[`${day.toLowerCase()}_close_hr`];

        updatedSchedule[day] = {
          open: parseTime(openHr),
          close: parseTime(closeHr),
        };
      });

      setSchedule(updatedSchedule);
    }
  }, [selectedSchedule]);

  const convertTo24Hour = (hour, minute, period) => {
    if (!hour || !minute || !period) return null;
    let hour24 = parseInt(hour);
    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    return `${hour24.toString().padStart(2, '0')}:${minute}:00`;
  };

  const formatScheduleForAPI = () => {
    const formattedSchedule = { name };
    Object.keys(schedule).forEach((day) => {
      formattedSchedule[`${day.toLowerCase()}_open_hr`] = convertTo24Hour(
        schedule[day].open.hour,
        schedule[day].open.minute,
        schedule[day].open.period
      );
      formattedSchedule[`${day.toLowerCase()}_close_hr`] = convertTo24Hour(
        schedule[day].close.hour,
        schedule[day].close.minute,
        schedule[day].close.period
      );
    });
    return formattedSchedule;
  };

  const handleSubmit = async () => {
    const formData = formatScheduleForAPI();
    try {
      if (selectedSchedule) {
        await updateScheduleForVenue(selectedSchedule.id, venue.id ,formData);
      } else {
        await assignScheduleToVenue(venue.id, formData);
      }

      nav.goBack();
      
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <View style={settingsStyles.container}>
      <ScrollView>
        <Text style={settingsStyles.title}>Hours Of Operations</Text>
        <Text style={settingsStyles.subtitle}>
          Make sure your hours of operations are up to date.
        </Text>
        <View style={settingsStyles.horizontalLine} />
        <TextInput
          style={styles.input}
          placeholder="Enter schedule name"
          value={name}
          onChangeText={setName}
        />

        {Object.keys(schedule).map((day) => (
          <View key={day} style={styles.dayContainer}>
            <Text style={styles.dayLabel}>{day}</Text>

            <View style={styles.timePickerContainer}>
              <TimePicker
                selectedValue={schedule[day].open.hour}
                onValueChange={(value) => handleChange(day, 'open', 'hour', value)}
                options={hours}
                label="Hour"
              />
              <TimePicker
                selectedValue={schedule[day].open.minute}
                onValueChange={(value) => handleChange(day, 'open', 'minute', value)}
                options={minutes}
                label="Min"
              />
              <TimePicker
                selectedValue={schedule[day].open.period}
                onValueChange={(value) => handleChange(day, 'open', 'period', value)}
                options={periods}
                label="AM/PM"
              />
              <Text style={styles.toLabel}>to</Text>
              <TimePicker
                selectedValue={schedule[day].close.hour}
                onValueChange={(value) => handleChange(day, 'close', 'hour', value)}
                options={hours}
                label="Hour"
              />
              <TimePicker
                selectedValue={schedule[day].close.minute}
                onValueChange={(value) => handleChange(day, 'close', 'minute', value)}
                options={minutes}
                label="Min"
              />
              <TimePicker
                selectedValue={schedule[day].close.period}
                onValueChange={(value) => handleChange(day, 'close', 'period', value)}
                options={periods}
                label="AM/PM"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginVertical: 10,
    borderRadius: 5,
  },
  dayContainer: {
    marginBottom: 20,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toLabel: {
    marginHorizontal: 10,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HoursOfOperationsScreen;