export interface RouteData {
    _id?: string;
    id?: string;
    from: string;
    to: string;
    type: 'taxi' | 'bus' | 'calafia' | string;
    schedule?: {
        start: string;
        end: string;
    };
    color: string;
    description: string;
    path: [number, number][] | any;
    landmarks: string[];
    active?: boolean;
    updated?: {
        user: string;
        date: Date | string;
    };
    createdAt?: Date | string;
    updatedAt?: Date | string;
}