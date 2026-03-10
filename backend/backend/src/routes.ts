import { websiteConfig } from './config/website';

/**
 * The routes for the application
 */
export enum Routes {
  Root = '/',

  // marketing pages
  FAQ = '/#faq',
  Features = '/#features',
  Pricing = '/pricing', // change to /#pricing if you want to use the pricing section in homepage
  Tools = '/tools',
  ToolsSubmit = '/tools/submit',
  Blog = '/blog',
  About = '/about',
  Waitlist = '/waitlist',
  Changelog = '/changelog',
  Roadmap = 'https://mksaas.link/roadmap',
  CookiePolicy = '/cookie',
  PrivacyPolicy = '/privacy',
  TermsOfService = '/terms',
  RefundPolicy = '/refund',

  // auth routes
  Login = '/auth/login',
  Register = '/auth/register',
  AuthError = '/auth/error',
  ForgotPassword = '/auth/forgot-password',
  ResetPassword = '/auth/reset-password',

  // protected routes
  Admin = '/admin',
  AdminUsers = '/admin/users',
  AdminGenerations = '/admin/generations',
  AdminSubmissions = '/admin/submissions',
  AdminTools = '/admin/tools',
  AdminTags = '/admin/tags',
  AdminReviews = '/admin/reviews',
  SettingsProfile = '/settings/profile',
  SettingsSecurity = '/settings/security',
  SettingsSubmissions = '/settings/submissions',
  SettingsNotifications = '/settings/notifications',
  SettingsHistory = '/settings/history',

  // AI routes (Legacy Marketing - might deprecate later)
  AIText = '/ai/text',
  AIChat = '/ai/chat',
  AIAudio = '/ai/audio',

  // App Routes (The new "Studio" architecture)
  AppVideo = '/app/video',
  AppProject = '/app/project',
  AppCreate = '/app/create', // Redirect handler

  // Vertical Marketing Pages (SEO)
  MarketingTextToImage = '/text-to-image',

  // block routes
  MagicuiBlocks = '/magicui',
  HeroBlocks = '/blocks/hero-section',
  LogoCloudBlocks = '/blocks/logo-cloud',
  FeaturesBlocks = '/blocks/features',
  IntegrationsBlocks = '/blocks/integrations',
  ContentBlocks = '/blocks/content',
  StatsBlocks = '/blocks/stats',
  TeamBlocks = '/blocks/team',
  TestimonialsBlocks = '/blocks/testimonials',
  CallToActionBlocks = '/blocks/call-to-action',
  FooterBlocks = '/blocks/footer',
  PricingBlocks = '/blocks/pricing',
  ComparatorBlocks = '/blocks/comparator',
  FAQBlocks = '/blocks/faqs',
  LoginBlocks = '/blocks/login',
  SignupBlocks = '/blocks/sign-up',
  ForgotPasswordBlocks = '/blocks/forgot-password',
  ContactBlocks = '/blocks/contact',
}

/**
 * The routes that can not be accessed by logged in users
 */
export const routesNotAllowedByLoggedInUsers = [Routes.Login, Routes.Register];

/**
 * The routes that are protected and require authentication
 */
export const protectedRoutes = [
  Routes.Admin,
  Routes.AdminUsers,
  Routes.AdminGenerations,
  Routes.AdminSubmissions,
  Routes.AdminTools,
  Routes.AdminTags,
  Routes.AdminReviews,
  Routes.SettingsProfile,
  Routes.SettingsSecurity,
  Routes.SettingsSubmissions,
  // Routes.SettingsNotifications,
  // Routes.SettingsHistory,
];

/**
 * The default redirect path after logging in
 */
export const DEFAULT_LOGIN_REDIRECT =
  websiteConfig.routes.defaultLoginRedirect ?? Routes.Root;
