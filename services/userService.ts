

export const registerUser = async (email: string) => {
    try {
        await fetch('/api/register-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
    } catch (error) {
        console.error('Failed to register user for notifications', error);
    }
};

export const logUserActivity = async (email: string, activityType: 'food', details: any) => {
    try {
        await fetch('/api/log-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, details }),
        });
    } catch (error) {
        console.error('Failed to log user activity', error);
    }
};

export const logWorkout = async (email: string, caloriesBurned: number) => {
    try {
        await fetch('/api/log-workout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, caloriesBurned }),
        });
    } catch (error) {
        console.error('Failed to log workout', error);
    }
};

export const fetchUserActivity = async (email: string) => {
    try {
        const response = await fetch(`/api/user-activity?email=${email}`);
        if (!response.ok) throw new Error('Failed to fetch activity');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch user activity', error);
        return null;
    }
};

