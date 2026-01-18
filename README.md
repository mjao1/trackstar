# Trackstar

A discrete bike theft detection and prevention device that sends real-time alerts to your phone with GPS tracking capabilities.

## Problem Statement

[More than 50%](https://www.macalester.edu/public-safety/crime-prevention/bike_theft_prevention/) of property crimes reported to the University of California involve bicycle theft. This project aims to address this critical issue affecting UC students by providing a discrete theft detection, prevention, and tracking system. By helping students protect their bikes, we're contributing to campus safety and justice, ensuring students can focus on their education without the financial and emotional burden of bike theft.

## Overview

Trackstar is a bike theft prevention system consisting of a hardware device and mobile app:

- **Hardware Device**: A small, discrete device that attaches to your bike and monitors for unauthorized movement
- **Mobile App**: Receive instant alerts when motion is detected, view your bike's location on a map, and remotely trigger an alarm
- **Real-time Tracking**: When theft is detected, the device automatically sends GPS coordinates so you can track your bike's location

## How It Works

1. **Pair Your Device**: Scan a QR code to pair the hardware device with your phone
2. **Activate Watch Mode**: After parking your bike, activate "Watch" mode through the app
3. **Get Alerts**: If your bike detects unexpected movement, you'll receive a push notification from the app
4. **Track & Deter**: View your bike's location on an integrated map and trigger an alarm to deter thieves

## Extra Features

- **Motion History**: View a log of all motion detection events
- **Dark/Light Mode**: Choose your preferred app theme
- **Low Power**: Efficient embedded design for extended battery life

## App States

### Idle
- Device is in low power mode
- Tap the button to activate "Watch" mode when you park your bike

### Watch
- Device actively monitors for movement
- If motion is detected, you'll be notified immediately
- View motion detection history anytime

### Theft Detected
- You receive an alert when motion is detected
- Confirm if the movement was you or not
- If not you: View GPS location on map and trigger alarm
- Device automatically returns to Watch mode after 10 seconds of no movement

## Components

### Hardware
- ESP32 microcontroller with WiFi connectivity
- Accelerometer for motion sensing
- GPS module for location tracking
- Buzzer for alarm functionality
- LiPo Battery for portability

### Software
- **Mobile App**: React Native app for iOS and Android. Handles user authentication, device pairing via QR code scanning, and real-time status monitoring. Features push notifications for motion alerts, integrated Google Maps for GPS tracking.
- **Backend**: Server that connects your device and app. Manages user accounts and device ownership, validates device authentication, and stores commands for devices to poll. Handles motion events and GPS coordinates from devices, and sends push notifications to the mobile app.
- **Device Firmware**: Embedded logic running on the hardware device. Implements motion detection using accelerometer data, manages WiFi connectivity for HTTP communication with the backend, and handles GPS coordinate reading and transmission. Controls device states (Idle/Watch/Theft Detected) and manages alarm activation.

