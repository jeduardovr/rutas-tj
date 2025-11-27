export interface RouteData {
    _id?: string;
    id?: string;
    name: string;
    type: 'taxi' | 'bus' | 'calafia' | string;
    color: string;
    description: string;
    path: [number, number][];
    landmarks: string[];
}