import React, { Suspense, lazy } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';

// Lazy-load all feature pages to isolate crashes and improve load time
const Login = lazy(() => import('./features/Login'));
const Dashboard = lazy(() => import('./features/Dashboard'));
const DietPlanner = lazy(() => import('./features/DietPlanner'));
const ReportAnalyzer = lazy(() => import('./features/ReportAnalyzer'));
const CalorieCounter = lazy(() => import('./features/CalorieCounter'));
const ExerciseCorner = lazy(() => import('./features/ExerciseCorner'));
const TodaysGoal = lazy(() => import('./features/TodaysGoal'));
const LocationTracker = lazy(() => import('./features/LocationTracker'));
const ActivityTracker = lazy(() => import('./features/ActivityTracker'));
const GymManagement = lazy(() => import('./features/GymManagement'));
const SkinDiseaseDetector = lazy(() => import('./features/SkinDiseaseDetector'));
const MedicalImaging = lazy(() => import('./features/MedicalImaging'));

const PageLoader: React.FC = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
        </div>
    </div>
);

const AppContent: React.FC = () => {
    const { user, currentPage } = useAppContext();

    if (!user) {
        return (
            <Suspense fallback={<PageLoader />}>
                <Login />
            </Suspense>
        );
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'DASHBOARD': return <Dashboard />;
            case 'DIET_PLANNER': return <DietPlanner />;
            case 'REPORT_ANALYZER': return <ReportAnalyzer />;
            case 'CALORIE_COUNTER': return <CalorieCounter />;
            case 'EXERCISE_CORNER': return <ExerciseCorner />;
            case 'TODAYS_GOAL': return <TodaysGoal />;
            case 'LOCATION_TRACKER': return <LocationTracker />;
            case 'ACTIVITY_TRACKER': return <ActivityTracker />;
            case 'GYM_MANAGEMENT': return <GymManagement />;
            case 'SKIN_DISEASE_DETECTOR': return <SkinDiseaseDetector />;
            case 'MEDICAL_IMAGING': return <MedicalImaging />;
            case 'EDIT_PROFILE': return <Login />;
            default: return <Dashboard />;
        }
    };

    return (
        <Layout>
            <Suspense fallback={<PageLoader />}>
                {renderPage()}
            </Suspense>
        </Layout>
    );
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

export default App;