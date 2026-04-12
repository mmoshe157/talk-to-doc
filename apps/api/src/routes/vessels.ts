import { Router, type IRouter } from "express";

export const vesselsRouter: IRouter = Router();

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  coordinates: { lat: number; lng: number };
  destination: string;
  eta: string;
  status: string;
}

// In production this would come from a database or AIS feed
const vessels: Vessel[] = [
  {
    id: "default",
    name: "MV Northern Star",
    imo: "9413241",
    coordinates: { lat: 1.2897, lng: 103.8501 },
    destination: "Port of Rotterdam",
    eta: "2026-04-25",
    status: "Anchored off Singapore",
  },
];

vesselsRouter.get("/", (_req, res) => {
  res.json(vessels);
});

vesselsRouter.get("/:id", (req, res) => {
  const vessel = vessels.find((v) => v.id === req.params.id);
  if (!vessel) {
    res.status(404).json({ error: "Vessel not found" });
    return;
  }
  res.json(vessel);
});
