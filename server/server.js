const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Ativa o CORS para que a extensão (Chrome) possa consumir esta API local
app.use(cors());
app.use(express.json());

// Rota que a extensão vai chamar para obter os dados de acessibilidade
app.get('/api/avaliar', (req, res) => {
    const urlParaAvaliar = req.query.url;
    console.log(`[Servidor] Solicitação de avaliação recebida para: ${urlParaAvaliar}`);

    const jsonPath = path.join(__dirname, 'mock_amaweb.json');

    fs.readFile(jsonPath, 'utf8', (err, data) => {
        if (err) {
            console.error("[Servidor] Erro ao ler o arquivo de testes:", err);
            return res.status(500).json({ error: "Erro interno no servidor de testes." });
        }
        
        const dadosAvaliacao = JSON.parse(data);
        res.json(dadosAvaliacao);
    });
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Servidor BFF ativo em http://localhost:${PORT}`);
    console.log(` Teste no navegador: http://localhost:${PORT}/api/avaliar?url=https://x.com/`);
    console.log(`====================================================`);
});