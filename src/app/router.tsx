import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";
import { PublicLayout } from "./layouts/public-layout";
import { BusinessLayout } from './layouts/business-layout';
import { HomePage } from "../features/home/pages/home-page";
import { FeaturesPage } from "../features/home/pages/features-page";
import { NotFoundPage } from "../components/feedback/not-found-page";
import { ProtectedRoute } from "../features/auth/components/protected-route";
const LoginPage = lazy(() =>
  import("../features/auth/pages/login-page").then((module) => ({
    default: module.LoginPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../features/auth/pages/register-page").then((module) => ({
    default: module.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("../features/auth/pages/forgot-password-page").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("../features/auth/pages/reset-password-page").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const AuthCallbackPage = lazy(() =>
  import("../features/auth/pages/auth-callback-page").then((module) => ({
    default: module.AuthCallbackPage,
  })),
);
const BusinessesPage = lazy(() =>
  import("../features/businesses/pages/businesses-page").then((module) => ({
    default: module.BusinessesPage,
  })),
);
const CreateBusinessPage = lazy(() =>
  import("../features/businesses/pages/create-business-page").then(
    (module) => ({ default: module.CreateBusinessPage }),
  ),
);
const BusinessPage = lazy(() =>
  import("../features/businesses/pages/business-page").then((module) => ({
    default: module.BusinessPage,
  })),
);
const ServicesPage = lazy(() =>
  import("../features/services/pages/services-page").then((module) => ({
    default: module.ServicesPage,
  })),
);

const EmployeesPage = lazy(() =>
  import("../features/employees/pages/employees-page").then((module) => ({ default: module.EmployeesPage })),
);

const SchedulePage = lazy(() =>
  import("../features/schedules/pages/schedule-page").then((module) => ({ default: module.SchedulePage })),
);

const AvailabilityPage = lazy(() =>
  import("../features/availability/pages/availability-page").then((module) => ({ default: module.AvailabilityPage })),
);

const PublicBookingPage = lazy(() =>
  import('../features/booking/public-booking-page').then((module) => ({ default: module.PublicBookingPage })),
);

const ReservationsPage = lazy(() =>
  import('../features/reservations/reservations-page').then((module) => ({ default: module.ReservationsPage })),
);

const CustomerBookingPage = lazy(() => import('../features/booking/customer-booking-page').then((module) => ({ default: module.CustomerBookingPage })))
// Google Calendar temporariamente desativado para o lançamento. Reativar após configurar OAuth.
// const CalendarCallbackPage = lazy(() => import('../features/calendar/calendar-callback-page').then((module) => ({ default: module.CalendarCallbackPage })))
const InsightsPage = lazy(() => import('../features/insights/insights-page').then((module) => ({ default: module.InsightsPage })))
const ProfilePage = lazy(() => import('../features/profile/profile-page').then((module) => ({ default: module.ProfilePage })))

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="project" element={<Navigate to="/features" replace />} />
        <Route path="demo" element={<Navigate to="/" replace />} />
        <Route path="book/:slug" element={<PublicBookingPage />} />
        <Route path="booking/manage/:bookingId" element={<CustomerBookingPage />} />
        {/* Google Calendar temporariamente desativado.
        <Route path="calendar/callback" element={<CalendarCallbackPage />} />
        */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="account" element={<ProfilePage />} />
          <Route path="dashboard" element={<BusinessesPage />} />
          <Route path="onboarding" element={<CreateBusinessPage />} />
          <Route element={<BusinessLayout />}>
          <Route path="dashboard/:businessId" element={<BusinessPage />} />
          <Route path="dashboard/:businessId/reservations" element={<ReservationsPage />} />
          <Route path="dashboard/:businessId/insights" element={<InsightsPage />} />
          <Route path="dashboard/:businessId/availability" element={<AvailabilityPage />} />
          <Route path="dashboard/:businessId/employees" element={<EmployeesPage />} />
          <Route path="dashboard/:businessId/employees/:employeeId/schedule" element={<SchedulePage />} />
          <Route path="dashboard/:businessId/services" element={<ServicesPage />}
          />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
