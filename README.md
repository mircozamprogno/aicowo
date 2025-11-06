# Location Management Application

A comprehensive React-based application for managing locations, resources, and user access with role-based permissions and real-time data synchronization.

## 🌟 Features

### Core Functionality
- **Location Management** - Create, edit, and organize multiple locations
- **Resource Management** - Manage desks, rooms, and other resources per location
- **Image Gallery** - Upload and organize location images with categories
- **Interactive Maps** - Geocoding and map integration for location visualization
- **Role-Based Access Control** - Multi-level permissions (superadmin, admin, user)

### User Experience
- **Responsive Design** - Mobile-first approach with tablet and desktop optimization
- **Real-time Updates** - Live data synchronization across users
- **Intuitive Interface** - Clean, modern UI with smooth animations
- **Multi-language Support** - Internationalization ready

### Technical Features
- **Authentication & Authorization** - Secure user management with Supabase
- **Profile Management** - User profiles with partner associations
- **Data Validation** - Form validation and error handling
- **Performance Optimized** - Efficient loading and caching strategies

## 🛠 Tech Stack

### Frontend
- **React** - Component-based UI framework
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Modern icon library
- **Custom CSS** - Enhanced styling for complex components

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Real-time subscriptions
  - Authentication
  - File storage
  - Row Level Security (RLS)

### Additional Services
- **Geocoding API** - Address to coordinates conversion
- **Map Integration** - Interactive location mapping
- **Image Processing** - Upload and optimization

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone [your-repo-url]
   cd location-management-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file:
   ```env
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   REACT_APP_GEOCODING_API_KEY=your_geocoding_api_key
   ```

4. **Database Setup**
   - Set up your Supabase project
   - Run the provided SQL schema
   - Configure Row Level Security policies
   - Set up storage buckets for images

5. **Start Development Server**
   ```bash
   npm start
   ```

## 📁 Project Structure

```
src/
├── components/
│   ├── auth/              # Authentication components
│   ├── common/            # Shared components (Router, Sidebar, etc.)
│   └── ui/                # Reusable UI components
├── contexts/
│   ├── AuthContext.jsx    # Authentication state management
│   └── LanguageContext.jsx # Internationalization
├── pages/                 # Main application pages
├── services/
│   ├── supabase.js       # Supabase client configuration
│   └── customerService.js # Customer data operations
├── styles/
│   └── locations.css     # Custom component styles
└── utils/                # Helper functions
```

## 🔐 User Roles & Permissions

### Superadmin
- Full system access
- Manage all partners and locations
- User management across all organizations
- System-wide settings and configuration

### Admin (Partner Admin)
- Manage their organization's locations
- Create and manage resources
- Invite and manage users within their organization
- View bookings and contracts for their locations

### User
- View assigned locations
- Access photo galleries
- View personal contracts and bookings
- Manage personal profile and settings

## 🗃 Database Schema

### Core Tables
- **profiles** - User information and role assignments
- **partners** - Organization/company information
- **locations** - Location data with geocoding
- **resources** - Desks, rooms, and other bookable items
- **location_images** - Image gallery with categorization
- **bookings** - Resource reservations
- **contracts** - User agreements and terms

## 🔧 Configuration

### Supabase Setup
1. **Authentication** - Configure email/password authentication
2. **Storage** - Set up buckets for partner logos and location images
3. **Row Level Security** - Implement data access policies
4. **Real-time** - Enable subscriptions for live updates

### Environment Variables
- `REACT_APP_SUPABASE_URL` - Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase anonymous key
- `REACT_APP_GEOCODING_API_KEY` - Geocoding service API key

## 🚨 Known Issues

### Browser Compatibility
- **Storage APIs** - localStorage/sessionStorage not supported in artifacts
- **Loading States** - Potential infinite loading after inactivity (fixed with timeout implementation)

### Recommendations
- Regular browser refresh after extended inactivity
- Use modern browsers for optimal experience
- Ensure stable internet connection for real-time features

## 🛡 Security Features

- **Row Level Security** - Database-level access control
- **Role-based Permissions** - Frontend and backend validation
- **Secure Authentication** - Supabase managed auth
- **Data Validation** - Input sanitization and validation
- **CORS Protection** - Proper cross-origin configuration

## 📱 Responsive Design

- **Mobile First** - Optimized for mobile devices
- **Tablet Support** - Enhanced tablet experience
- **Desktop** - Full-featured desktop interface
- **Touch Friendly** - Gesture support for mobile interactions

## 🔄 Development Workflow

1. **Feature Development** - Create feature branches
2. **Testing** - Test across different user roles
3. **Database Migration** - Use Supabase migrations
4. **Deployment** - Deploy to production environment

## 📞 Support

For technical issues or feature requests:
- Check existing issues in the repository
- Create detailed bug reports with steps to reproduce
- Include browser and device information

## 📄 License

[Your License Here]

---

Built with ❤️ using React and Supabase


Version:

2025.11.06 V 0.710 Mail con templates interne 
2025.11.06 V 0.700 Mail con templates interne 
2025.09.26 V 0.670 Prenotazione dal calendario prenotazioni per partners 
2025.09.26 V 0.660 Modifiche e miglioramenti 
2025.09.20 V 0.650 Modifiche Dashboard e altro Andrea 
2025.09.16 V 0.640 Dashboard e Supporto  
2025.09.15 V 0.630 Sedi, contratti icone, cancellazione contratti  
2025.09.14 V 0.620 Miglioramenti  
2025.09.07 V 0.610 Partner Form FattureInCloud 
2025.09.07 V 0.600 Partner Contracts Management 
2025.09.05 V 0.540 Updated SQLs 
2025.09.04 V 0.530 Fatture in cloud 
2025.09.03 V 0.520 Invio mail prenotazione 
2025.09.02 V 0.510 Partner Guided Tour 
2025.09.01 V 0.500 Payments + export CSV
2025.08.30 V 0.410 Dashboard with cards, new status
2025.08.28 V 0.400 Iva, Status, Tipo cliente
2025.08.23 V 0.320 Reset Password
           V 0.310 Powercowo logo
           V 0.300 Archived contract and finale delete
           V 0.250 Pagination and record delete for the invitations page
           V 0.240 Fix per ridurre il tempo di loading quando si cambia tab
           V 0.230 Fix per invio mail con messaggio personalizzato
           V 0.220 Fix loading spinning$
           V 0.210 Maps Locations + Api Server
           V 0.200 Maps Locations
           V 0.140 Image Gallery
