import { Router, Request, Response } from 'express';
import { searchCities, getWeatherForecast } from '../services/weatherService.js';
import { evaluateFuzzyWatering } from '../fuzzy/engine.js';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.json({ results: [] });
      return;
    }
    const results = await searchCities(q);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search cities' });
  }
});

router.get('/live', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'Valid lat and lon query parameters are required' });
      return;
    }

    const { snapshot, isFallback } = await getWeatherForecast(lat, lon);
    res.json({ snapshot, isFallback });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weather forecast' });
  }
});

router.post('/fuzzy-test', (req: Request, res: Response) => {
  try {
    const { temp, humidity, rainMm, environment, droughtTolerance, potMaterial, baseWaterMl } = req.body;
    const result = evaluateFuzzyWatering({
      temp: Number(temp) || 20,
      humidity: Number(humidity) || 50,
      rainMm: Number(rainMm) || 0,
      environment: environment || 'indoor',
      droughtTolerance: droughtTolerance || 'medium',
      potMaterial: potMaterial || 'plastic',
      baseWaterMl: Number(baseWaterMl) || 300,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Fuzzy calculation error' });
  }
});

export default router;
