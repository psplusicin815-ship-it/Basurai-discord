import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = [
  /localhost/,
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /\.infinityfreeapp\.com$/,
  /\.epizy\.com$/,
  /\.rf\.gd$/,
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(new RegExp(process.env.FRONTEND_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some((pattern) =>
        pattern instanceof RegExp ? pattern.test(origin) : origin === pattern,
      );
      callback(null, allowed ? origin : false);
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
