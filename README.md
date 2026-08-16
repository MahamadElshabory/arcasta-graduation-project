# ARcasta

> An AI- and AR-powered furniture marketplace that helps customers discover, visualize, and purchase furniture through a mobile application, while allowing suppliers to manage products through a web platform.

ARcasta was developed as a team graduation project. The platform combines a customer-facing mobile application, a supplier website, backend services, an AI chatbot, augmented-reality furniture visualization, and a 3D-model generation pipeline.

---

## Project Overview

ARcasta is a furniture marketplace built to solve a real pain point in furniture shopping: you can't tell how a piece will actually look in your space from a product photo. The app combines standard mobile commerce with augmented-reality visualization, so customers can place furniture in their own room virtually before buying, plus AI-assisted product search and a chatbot for guided shopping.

It was built by a team spanning mobile (Flutter), web, AI, and AR — I owned the backend layer that all of those surfaces depended on. That meant the actual challenge on my end wasn't any single feature in isolation, but designing an API contract stable and flexible enough for four different frontends, built by different teammates in parallel, to all consume correctly without breaking each other's work as the project evolved.

Buying furniture online can be difficult because customers cannot easily imagine how a product will look inside their own space.

ARcasta addresses this problem by allowing users to:

- Browse furniture products
- Search and filter available items
- Add products to favorites and cart
- Complete checkout and manage delivery information
- View and submit product reviews
- Ask an AI chatbot for product assistance
- Visualize furniture in real environments using augmented reality
- Interact with generated 3D furniture models

Suppliers can use the web platform to manage products and related marketplace data.

---
## My role — Backend
Authentication: signup/login, OTP verification, password recovery
Customer profile management
Shopping cart, favorites, and checkout flow
Shipping addresses and payment method management
Product review system
Marketplace product data endpoints
Chatbot integration for product search

## What I focused on

Keeping the backend contract consistent and well-documented enough that mobile, web, and AI teammates could build against it independently without constant back-and-forth — and handling the auth/checkout flow correctly, since it touches every other part of the system.

## Main Features

### Customer Mobile Application

- Customer registration and login
- OTP verification and password recovery
- User-profile management
- Product browsing and search
- Product details
- Favorites
- Shopping cart
- Checkout workflow
- Payment-method selection
- Shipping-address management
- Product reviews
- AI chatbot integration
- AR furniture visualization

### Supplier Web Platform

- Supplier authentication
- Product-management workflows
- Marketplace data management
- Order-related functionality

### AI and AR Components

- Natural-language chatbot assistance
- Product-search support
- Augmented-reality furniture placement
- 3D-model generation pipeline for interactive visualization

---



## High-Level Architecture

```text
Customer Mobile App
        |
        v
Mobile Backend APIs --------> Database
        |
        +--------------------> AI Chatbot Service
        |
        +--------------------> AR / 3D Services

Supplier Web Platform
        |
        v
Web Backend APIs -----------> Database



