
export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
    name: string;
    email: string;
    age: number;
    gender: Gender;
    height: number; // in cm
    weight: number; // in kg
    bmi: number;
    password?: string;
}

export type Page = 'DASHBOARD' | 'DIET_PLANNER' | 'REPORT_ANALYZER' | 'CALORIE_COUNTER' | 'EXERCISE_CORNER' | 'TODAYS_GOAL' | 'LOCATION_TRACKER' | 'EDIT_PROFILE' | 'ACTIVITY_TRACKER' | 'GYM_MANAGEMENT' | 'SKIN_DISEASE_DETECTOR' | 'MEDICAL_IMAGING';


export interface CatalogExercise {
    id: string;
    name: string;
    muscles: string[]; // Primary muscles targeted
    equipment: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    imageUrl?: string;
    videoUrl?: string;
    description?: string;
}

export interface LoggedFood {
    name: string;
    calories: number;
    source: 'plan' | 'counter';
}

export interface DailyLog {
    date: string;
    caloriesIn: number; // For graph - only from 'counter' source
    caloriesOut: number;
    loggedFoods: LoggedFood[];
}

export interface MealOption {
    name: string;
    calories: number;
    description: string;
}

export interface Meal {
    breakfast: MealOption[];
    lunch: MealOption[];
    snacks: MealOption[];
    dinner: MealOption[];
}

export interface DietPlan {
    mealPlan: Meal;
    reasoning: string;
    healthRecommendations: string[];
    foodsToInclude: string[];
    foodsToAvoid: string[];
    precautions: string[];
    exerciseRoutine: Exercise[];
    lifestyleModifications: string[];
}

export interface ReportAnalysis extends DietPlan {
    reportSummary: string;
    patientInfo: {
        name: string;
        age: number;
        gender: string;
        reportDate: string;
    };
    actionPlan: string[];
    treatmentRecommendations: string[];
    problemExplanation: string;
    keyRecommendations: string[];
}

export interface IdentifiedFood {
    id: string;
    name: string;
    weight: number;
    cookingMethod: string; // Added for accuracy
}

export interface FoodItem {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    source: 'USDA' | 'AI' | 'USER';
    confidence?: number; // AI's confidence in its own estimation
    healthVerdict?: string; // New field for health pros/cons
}

export interface CalorieAnalysisResult {
    foodItems: FoodItem[];
    accuracy: number;
}

export interface Exercise {
    name: string;
    reps: string;
    sets: number;
    caloriesBurnedPerSet: number;
    youtubeQuery: string;
    videoScript: string;
    steps: string[];
    modifications?: string[];
}


export interface WorkoutRoutine {
    warmUp: Exercise[];
    mainWorkout: Exercise[];
    coolDown: Exercise[];
}

export interface SingleExerciseInfo {
    name: string;
    youtubeQuery: string;
    steps: string[];
    tips: string[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface HealthServiceLocation {
    name: string;
    address: string;
    mapsUri: string;
    latitude: number;
    longitude: number;
    rating?: number;
}

export interface NearbyHealthServices {
    hospitals: HealthServiceLocation[];
    clinics: HealthServiceLocation[];
    medicalStores: HealthServiceLocation[];
}

// Skin Disease Analysis result returned by Gemini Vision
export interface SkinDiseaseAnalysis {
    diseaseName: string;
    causes: string[];
    homeRemedies: string[];
    medicalTreatments: string[];
    severity: 'Mild' | 'Moderate' | 'Serious';
    additionalNotes: string;
    preventionTips: string[];
    riskFactors: string[];
    isContagious: boolean;
}

// Nearby dermatologist / skin clinic location
export interface DermatologistLocation {
    name: string;
    address: string;
    mapsUri: string;
    rating?: number;
}

// Drug Impact Analysis Result
export interface DrugAnalysisResult {
    drug_name: string;
    category: string;
    risk_level: 'Low' | 'Moderate' | 'High';
    mechanism: string;
    primary_organs: string[];
    short_term_effects: string[];
    long_term_effects: string[];
    side_effects: string[];
    contraindications: string[];
    detailed_explanation: string;
}