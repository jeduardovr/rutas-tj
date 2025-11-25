export interface RouteData {
    id?: string;
    _id?: string;  // MongoDB ID
    name: string;
    type: 'taxi' | 'bus' | 'calafia';
    color: string;
    description: string;
    path: [number, number][] | { type: string; coordinates: [number, number][] };  // Array directo o GeoJSON
    landmarks: string[];
}