export function renderMethods() {
  return `
    <div class="view-stack methods-view">
      <section class="card">
        <h2>Índice de Massa Corporal (IMC)</h2>
        <p>O IMC é calculado dividindo o peso em quilogramas pela altura em metros ao quadrado.</p>
        <p class="formula-block">IMC = peso (kg) ÷ altura² (m)</p>
        <p class="muted">No app, valores abaixo de 18,5 são classificados como abaixo do peso; de 18,5 a 24,9 como peso normal; de 25 a 29,9 como sobrepeso; e a partir de 30 como obesidade.</p>
        <p class="form-notice">O IMC é uma medida de triagem. Ele não distingue gordura, músculos e massa óssea, portanto deve ser interpretado junto de outras informações.</p>
      </section>

      <section class="card">
        <h2>Percentual de gordura por circunferências</h2>
        <p>A estimativa usa equações baseadas no método de circunferências associado à Marinha dos Estados Unidos.</p>
        <div class="grid two">
          <div>
            <h3>Masculino</h3>
            <p>Utiliza altura, circunferência abdominal e pescoço.</p>
          </div>
          <div>
            <h3>Feminino</h3>
            <p>Utiliza altura, cintura, pescoço e quadril.</p>
          </div>
        </div>
        <p class="muted">Pequenas diferenças na posição da fita, postura e respiração podem alterar o resultado. O acompanhamento da tendência costuma ser mais útil que uma medição isolada.</p>
      </section>

      <section class="card">
        <h2>Medição informada</h2>
        <p>O percentual também pode ser informado a partir de balança de bioimpedância, adipômetro, DEXA ou avaliação profissional.</p>
        <p class="muted">Métodos diferentes não são diretamente intercambiáveis. Para acompanhar evolução, prefira repetir o mesmo método e condições de medição.</p>
      </section>

      <section class="card">
        <h2>Metas e projeções</h2>
        <p>O peso sugerido parte do IMC alvo escolhido. O prazo relaciona a diferença entre peso inicial e peso final com a mudança semanal definida.</p>
        <p class="formula-block">Prazo estimado = diferença de peso ÷ mudança semanal</p>
        <p class="muted">As linhas planejadas representam uma tendência matemática. Variações de líquidos, alimentação, treino e rotina fazem com que os registros reais não sigam uma linha perfeitamente regular.</p>
      </section>

      <section class="card">
        <h2>Limitações e uso responsável</h2>
        <ul class="method-list">
          <li>Os resultados são estimativas para acompanhamento pessoal.</li>
          <li>Atletas e pessoas com muita massa muscular podem ter IMC elevado sem excesso equivalente de gordura.</li>
          <li>Bioimpedância pode variar com hidratação, alimentação, exercício e horário.</li>
          <li>Gestação, edema e algumas condições clínicas exigem interpretação profissional.</li>
          <li>O app não substitui diagnóstico, prescrição ou acompanhamento de saúde.</li>
        </ul>
      </section>

      <section class="card">
        <h2>Referências</h2>
        <div class="reference-list">
          <a href="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight" target="_blank" rel="noopener noreferrer">
            Organização Mundial da Saúde — Obesidade e sobrepeso
          </a>
          <a href="https://www.cdc.gov/bmi/about/index.html" target="_blank" rel="noopener noreferrer">
            CDC — Sobre o IMC e suas limitações
          </a>
          <a href="https://www.mynavyhr.navy.mil/Support-Services/Culture-Resilience/Physical-Readiness/Guides/" target="_blank" rel="noopener noreferrer">
            U.S. Navy — Body Composition Assessment Guide
          </a>
        </div>
      </section>
    </div>
  `;
}
