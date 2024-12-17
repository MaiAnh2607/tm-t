import pino from "pino";


const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport:
    {
        target: "pino-pretty",
        options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard",
        },
    },
    formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
