import app from './src/app.js';

const PORTA = Number(process.env.PORT) || 3333;

app.listen(PORTA, () => {
  console.log(`[govtrace-api] rodando em http://localhost:${PORTA}`);
});
