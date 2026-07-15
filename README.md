# ARcasta

> An AI- and AR-powered furniture marketplace that helps customers discover, visualize, and purchase furniture through a mobile application, while allowing suppliers to manage products through a web platform.

ARcasta was developed as a team graduation project. The platform combines a customer-facing mobile application, a supplier website, backend services, an AI chatbot, augmented-reality furniture visualization, and a 3D-model generation pipeline.

---

## Project Overview

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

## My Contribution

I worked primarily as the **Mobile Backend Developer** for this team project.

My responsibilities included:

- Developing JavaScript/Node.js backend functionality for mobile users
- Implementing customer registration and login
- Building OTP verification and password-recovery workflows
- Developing product and marketplace endpoints
- Implementing cart and favorites functionality
- Building checkout and payment-method workflows
- Implementing shipping-address management
- Developing product-review functionality
- Implementing customer profile editing
- Integrating database operations
- Connecting mobile backend services with the AI chatbot
- Collaborating with the mobile, web, AI, AR, and 3D teams through Git and GitHub

> Other parts of the system, including portions of the Flutter UI, supplier website, AI models, AR functionality, and 3D-model generation, were developed collaboratively by other members of the graduation-project team.

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
