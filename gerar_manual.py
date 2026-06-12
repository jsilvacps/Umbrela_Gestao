from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import Flowable

W, H = A4

# ── Cores ──────────────────────────────────────────────────────────────────
VERDE       = colors.HexColor("#16a34a")
VERDE_ESCURO= colors.HexColor("#052e16")
VERDE_CLARO = colors.HexColor("#dcfce7")
VERDE_MED   = colors.HexColor("#86efac")
CINZA       = colors.HexColor("#64748b")
CINZA_CLARO = colors.HexColor("#f1f5f9")
CINZA_BORDA = colors.HexColor("#e2e8f0")
ESCURO      = colors.HexColor("#1e293b")
BRANCO      = colors.white
AMARELO     = colors.HexColor("#fbbf24")
AZUL        = colors.HexColor("#3b82f6")
VERMELHO    = colors.HexColor("#ef4444")

# ── Estilos ────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def estilo(nome, **kw):
    return ParagraphStyle(nome, **kw)

sTituloCapa = estilo("TituloCapa",
    fontName="Helvetica-Bold", fontSize=36, textColor=BRANCO,
    alignment=TA_CENTER, leading=42)

sSubtituloCapa = estilo("SubtituloCapa",
    fontName="Helvetica", fontSize=16, textColor=VERDE_MED,
    alignment=TA_CENTER, leading=22)

sCapitulo = estilo("Capitulo",
    fontName="Helvetica-Bold", fontSize=20, textColor=BRANCO,
    alignment=TA_LEFT, leading=28,
    backColor=VERDE, borderPad=10)

sSecao = estilo("Secao",
    fontName="Helvetica-Bold", fontSize=14, textColor=VERDE,
    alignment=TA_LEFT, leading=20, spaceBefore=14, spaceAfter=4)

sSubSecao = estilo("SubSecao",
    fontName="Helvetica-Bold", fontSize=11, textColor=ESCURO,
    alignment=TA_LEFT, leading=16, spaceBefore=10, spaceAfter=2)

sBody = estilo("Body",
    fontName="Helvetica", fontSize=10, textColor=ESCURO,
    alignment=TA_JUSTIFY, leading=16, spaceAfter=6)

sBold = estilo("Bold",
    fontName="Helvetica-Bold", fontSize=10, textColor=ESCURO,
    leading=16, spaceAfter=4)

sDica = estilo("Dica",
    fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#166534"),
    leading=14)

sAviso = estilo("Aviso",
    fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#92400e"),
    leading=14)

sRodape = estilo("Rodape",
    fontName="Helvetica", fontSize=8, textColor=CINZA,
    alignment=TA_CENTER)

sNumero = estilo("Numero",
    fontName="Helvetica-Bold", fontSize=9, textColor=BRANCO,
    alignment=TA_CENTER, leading=12)

# ── Helpers ────────────────────────────────────────────────────────────────
def hr(cor=CINZA_BORDA, espessura=0.5):
    return HRFlowable(width="100%", thickness=espessura, color=cor, spaceAfter=8, spaceBefore=8)

def espacar(n=8):
    return Spacer(1, n)

def dica(texto):
    data = [[Paragraph("💡 " + texto, sDica)]]
    t = Table(data, colWidths=[15*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), VERDE_CLARO),
        ("BOX",        (0,0), (-1,-1), 0.5, VERDE),
        ("LEFTPADDING",(0,0), (-1,-1), 10),
        ("RIGHTPADDING",(0,0),(-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0),(-1,-1), 7),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [VERDE_CLARO]),
    ]))
    return t

def aviso(texto):
    data = [[Paragraph("⚠️  " + texto, sAviso)]]
    t = Table(data, colWidths=[15*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fef9c3")),
        ("BOX",        (0,0), (-1,-1), 0.5, AMARELO),
        ("LEFTPADDING",(0,0), (-1,-1), 10),
        ("RIGHTPADDING",(0,0),(-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0),(-1,-1), 7),
    ]))
    return t

def titulo_secao(texto):
    dados = [[Paragraph(texto, sCapitulo)]]
    t = Table(dados, colWidths=[15*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), VERDE),
        ("LEFTPADDING",  (0,0), (-1,-1), 14),
        ("RIGHTPADDING", (0,0), (-1,-1), 14),
        ("TOPPADDING",   (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0), (-1,-1), 10),
        
    ]))
    return t

def passo(numero, titulo, descricao):
    num  = Paragraph(str(numero), sNumero)
    tit  = Paragraph(f"<b>{titulo}</b>", sBold)
    desc = Paragraph(descricao, sBody)
    data = [[num, [tit, desc]]]
    t = Table(data, colWidths=[1*cm, 14*cm])
    t.setStyle(TableStyle([
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
        ("BACKGROUND",   (0,0), (0,0),   VERDE),
        ("LEFTPADDING",  (0,0), (0,0),   3),
        ("RIGHTPADDING", (0,0), (0,0),   3),
        ("TOPPADDING",   (0,0), (0,0),   4),
        ("BOTTOMPADDING",(0,0), (0,0),   4),
        ("LEFTPADDING",  (1,0), (1,0),   10),
        ("TOPPADDING",   (1,0), (1,0),   2),
        ("BOTTOMPADDING",(1,0), (1,0),   4),
        ("ROWBACKGROUNDS", (1,0), (1,0), [CINZA_CLARO]),
        ("BOX",          (0,0), (-1,-1), 0.5, CINZA_BORDA),
    ]))
    return t

def tabela_recursos(linhas, cabecalho=None):
    col1 = 5*cm
    col2 = 10*cm
    dados = []
    if cabecalho:
        dados.append([
            Paragraph(f"<b>{cabecalho[0]}</b>", sBold),
            Paragraph(f"<b>{cabecalho[1]}</b>", sBold),
        ])
    for a, b in linhas:
        dados.append([Paragraph(a, sBold), Paragraph(b, sBody)])
    t = Table(dados, colWidths=[col1, col2])
    estilo_t = [
        ("GRID",         (0,0), (-1,-1), 0.4, CINZA_BORDA),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING",   (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("ROWBACKGROUNDS",(0,0),(-1,-1), [BRANCO, CINZA_CLARO]),
    ]
    if cabecalho:
        estilo_t += [
            ("BACKGROUND",   (0,0), (-1,0), VERDE),
            ("TEXTCOLOR",    (0,0), (-1,0), BRANCO),
        ]
    t.setStyle(TableStyle(estilo_t))
    return t

# ── Header/Footer ──────────────────────────────────────────────────────────
def cabecalho_rodape(canvas, doc):
    canvas.saveState()
    # Cabeçalho (exceto capa)
    if doc.page > 1:
        canvas.setFillColor(VERDE)
        canvas.rect(0, H - 1.2*cm, W, 1.2*cm, fill=1, stroke=0)
        canvas.setFillColor(BRANCO)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(1.5*cm, H - 0.85*cm, "🌿 Horti Gestão PDV — Manual de Instruções")
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(W - 1.5*cm, H - 0.85*cm, f"Página {doc.page}")
    # Rodapé
    canvas.setFillColor(CINZA_CLARO)
    canvas.rect(0, 0, W, 0.9*cm, fill=1, stroke=0)
    canvas.setFillColor(CINZA)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(W/2, 0.35*cm, "horti-gestao.vercel.app  |  Suporte via aba 🆘 Suporte no sistema")
    canvas.restoreState()

# ── Documento ──────────────────────────────────────────────────────────────
OUTPUT = "C:/Projetos/horti-gestao/Manual_Horti_Gestao.pdf"
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2.5*cm, rightMargin=2.5*cm,
    topMargin=2*cm,    bottomMargin=1.5*cm,
)

story = []

# ════════════════════════════════════════════════════════
# CAPA
# ════════════════════════════════════════════════════════
def capa(canvas, doc):
    canvas.saveState()
    # Fundo verde
    canvas.setFillColor(VERDE_ESCURO)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Faixa verde principal
    canvas.setFillColor(VERDE)
    canvas.rect(0, H*0.38, W, H*0.32, fill=1, stroke=0)
    # Ícone / Logo
    canvas.setFillColor(BRANCO)
    canvas.setFont("Helvetica-Bold", 72)
    canvas.drawCentredString(W/2, H*0.72, "🌿")
    # Título
    canvas.setFillColor(BRANCO)
    canvas.setFont("Helvetica-Bold", 40)
    canvas.drawCentredString(W/2, H*0.62, "Horti Gestão PDV")
    # Subtítulo
    canvas.setFillColor(VERDE_MED)
    canvas.setFont("Helvetica", 18)
    canvas.drawCentredString(W/2, H*0.55, "Manual de Instruções")
    # Linha decorativa
    canvas.setStrokeColor(VERDE_MED)
    canvas.setLineWidth(1.5)
    canvas.line(W*0.25, H*0.52, W*0.75, H*0.52)
    # Descrição
    canvas.setFillColor(colors.HexColor("#a7f3d0"))
    canvas.setFont("Helvetica", 12)
    canvas.drawCentredString(W/2, H*0.47, "Sistema PDV para Hortifruti e Pequeno Comércio")
    # Versão
    canvas.setFillColor(CINZA)
    canvas.setFont("Helvetica", 10)
    canvas.drawCentredString(W/2, H*0.08, "Versão 1.1  |  horti-gestao.vercel.app")
    # Rodapé capa
    canvas.setFillColor(VERDE)
    canvas.rect(0, 0, W, 1.5*cm, fill=1, stroke=0)
    canvas.setFillColor(BRANCO)
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(W/2, 0.55*cm, "Este manual é de uso exclusivo dos clientes Horti Gestão")
    canvas.restoreState()

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# ÍNDICE
# ════════════════════════════════════════════════════════
story.append(Paragraph("Índice", estilo("idx", fontName="Helvetica-Bold", fontSize=22, textColor=VERDE, spaceAfter=16)))
story.append(hr(VERDE, 2))

indice = [
    ("PARTE 1 — PARA O CLIENTE (DONO DA LOJA)", ""),
    ("1. Primeiros Passos", "3"),
    ("2. Painel PDV — Realizando Vendas", "4"),
    ("3. Painel ADM — Administração", "6"),
    ("4. Gerenciando Produtos", "7"),
    ("5. Gerenciando Clientes", "8"),
    ("6. Relatórios e Fechamento de Caixa", "9"),
    ("7. Operadores e Senhas", "10"),
    ("8. Solicitando Suporte", "11"),
    ("PARTE 2 — PARA O MASTER (ADMINISTRADOR DO SISTEMA)", ""),
    ("9. Painel Master — Visão Geral", "12"),
    ("10. Cadastrando Novos Clientes", "13"),
    ("11. Monitorando Clientes Online", "13"),
    ("12. Gerenciando Suporte", "14"),
]

for titulo, pagina in indice:
    if not pagina:
        story.append(espacar(10))
        story.append(Paragraph(titulo, estilo("idxsec", fontName="Helvetica-Bold", fontSize=10,
            textColor=VERDE, spaceAfter=4)))
    else:
        linha_data = [[
            Paragraph(titulo, estilo("idxitem", fontName="Helvetica", fontSize=10,
                textColor=ESCURO, leading=16)),
            Paragraph(f"<b>{pagina}</b>", estilo("idxpag", fontName="Helvetica-Bold",
                fontSize=10, textColor=VERDE, alignment=TA_CENTER))
        ]]
        t = Table(linha_data, colWidths=[13*cm, 2*cm])
        t.setStyle(TableStyle([
            ("LINEBELOW",    (0,0), (0,0), 0.3, CINZA_BORDA),
            ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING",  (0,0), (0,0), 4),
            ("TOPPADDING",   (0,0), (-1,-1), 3),
            ("BOTTOMPADDING",(0,0), (-1,-1), 3),
        ]))
        story.append(t)

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PARTE 1 — CLIENTE
# ════════════════════════════════════════════════════════

# ── Capítulo 1: Primeiros Passos ──────────────────────
story.append(titulo_secao("Parte 1 — Para o Cliente (Dono da Loja)"))
story.append(espacar(14))
story.append(Paragraph("1. Primeiros Passos", sSecao))
story.append(hr())

story.append(Paragraph("Como acessar o sistema pela primeira vez", sSubSecao))
story.append(Paragraph(
    "O Horti Gestão PDV pode ser acessado de duas formas: pelo <b>navegador web</b> "
    "(celular ou computador) ou pelo <b>aplicativo desktop</b> instalado no computador da loja. "
    "Siga os passos abaixo para configurar o sistema:", sBody))
story.append(espacar(6))

story.append(passo(1, "Acesse o sistema",
    "Abra o navegador e acesse: <b>horti-gestao.vercel.app/login</b> "
    "— ou abra o aplicativo Horti Gestão instalado no seu computador."))
story.append(espacar(6))
story.append(passo(2, "Digite o código de ativação",
    "Informe o <b>código de ativação</b> fornecido pelo suporte. "
    "Ele tem 6 letras/números, ex: <b>KRTV34</b>. Clique em Confirmar."))
story.append(espacar(6))
story.append(passo(3, "Configure sua empresa",
    "Na primeira vez, o sistema abrirá um assistente de configuração com 3 etapas: "
    "<b>dados da empresa</b> (nome e CNPJ), <b>senha ADM</b> e confirmação. "
    "Preencha tudo e clique em Concluir."))
story.append(espacar(6))
story.append(passo(4, "Faça login",
    "Após configurar, use o <b>usuário</b> e a <b>senha ADM</b> que você criou para entrar no sistema."))
story.append(espacar(10))

story.append(dica("Guarde bem seu código de ativação e sua senha ADM. Sem eles não é possível acessar o sistema."))
story.append(espacar(10))

story.append(Paragraph("Acessos disponíveis", sSubSecao))
story.append(tabela_recursos([
    ("🛒 PDV",       "Frente de caixa — onde são realizadas as vendas"),
    ("⚙️ ADM",       "Painel administrativo — produtos, clientes, relatórios, configurações"),
    ("📊 Dashboard", "Resumo do dia: vendas, ticket médio e totais"),
], cabecalho=("Tela", "Função")))

story.append(PageBreak())

# ── Capítulo 2: PDV ─────────────────────────────────
story.append(Paragraph("2. Painel PDV — Realizando Vendas", sSecao))
story.append(hr())

story.append(Paragraph("Como realizar uma venda", sSubSecao))
story.append(Paragraph(
    "O PDV é a tela principal de vendas. Nela você adiciona produtos, aplica descontos e "
    "finaliza a venda rapidamente.", sBody))
story.append(espacar(6))

for n, t, d in [
    (1, "Abra o Caixa", "Na tela de login ou ADM, clique em <b>Abrir Caixa (PDV)</b>. Informe o valor de abertura do caixa se solicitado."),
    (2, "Adicione produtos", "Digite o nome ou parte do nome do produto na barra de busca. Clique no produto para adicioná-lo à venda. Você pode alterar a quantidade clicando nos botões + e − ou digitando diretamente."),
    (3, "Aplique desconto (opcional)", "Clique no ícone de desconto (%) para aplicar um desconto em reais ou percentual no item ou na venda inteira."),
    (4, "Finalize a venda", "Clique em <b>Finalizar Venda</b>. Selecione a forma de pagamento: Dinheiro, Cartão, Pix ou outro. Confirme o valor recebido e clique em Confirmar."),
    (5, "Imprima o cupom", "Após confirmar, o sistema gera o cupom automaticamente. Clique em <b>Imprimir</b> para imprimir na impressora térmica."),
]:
    story.append(passo(n, t, d))
    story.append(espacar(5))

story.append(espacar(8))
story.append(dica("Para adicionar um produto rapidamente, use o campo de busca e pressione Enter — o produto é adicionado automaticamente."))
story.append(espacar(10))

story.append(Paragraph("Ações disponíveis no PDV", sSubSecao))
story.append(tabela_recursos([
    ("➕ Adicionar item",    "Clique no produto na lista ou busque pelo nome"),
    ("🗑️ Remover item",     "Clique no X ao lado do item na lista de venda"),
    ("% Desconto",          "Aplica desconto em item específico ou no total"),
    ("💰 Sangria",          "Registra retirada de dinheiro do caixa"),
    ("🔒 Fechar Caixa",     "Encerra o turno e gera relatório de fechamento"),
    ("🔍 Buscar Cupons",    "Consulta vendas anteriores pelo número do cupom"),
]))
story.append(espacar(10))

story.append(Paragraph("Formas de pagamento", sSubSecao))
story.append(tabela_recursos([
    ("💵 Dinheiro",  "Informe o valor recebido — o sistema calcula o troco automaticamente"),
    ("💳 Cartão",    "Débito ou crédito — registra o pagamento sem cálculo de troco"),
    ("📱 Pix",       "Pagamento via Pix — registra sem troco"),
    ("🤝 Misto",     "Combinação de dois meios de pagamento (ex: parte dinheiro + parte cartão)"),
]))

story.append(PageBreak())

# ── Capítulo 3: ADM ─────────────────────────────────
story.append(Paragraph("3. Painel ADM — Administração", sSecao))
story.append(hr())

story.append(Paragraph(
    "O painel ADM é a área de gestão da sua loja. Acesse pelo botão <b>ADM</b> na tela de login. "
    "É protegido por senha para garantir a segurança.", sBody))
story.append(espacar(8))

story.append(Paragraph("Abas disponíveis no ADM", sSubSecao))
story.append(tabela_recursos([
    ("⚙️ Empresa",     "Configure nome, logo, CNPJ, telefone e endereço da empresa"),
    ("🖨️ Cupom",       "Ajuste o cabeçalho, rodapé e largura do cupom fiscal (58mm ou 80mm)"),
    ("👥 Operadores",  "Cadastre, edite e bloqueie operadores de caixa e suas permissões"),
    ("📊 Relatórios",  "Veja vendas por período, formas de pagamento e produtos mais vendidos"),
    ("🏷️ Etiquetas",   "Gere e imprima etiquetas de preço para os produtos"),
    ("📦 Produtos",    "Gerencie o cadastro completo de produtos"),
    ("🆘 Suporte",     "Envie mensagem ao suporte técnico em caso de dúvidas ou problemas"),
], cabecalho=("Aba", "Função")))
story.append(espacar(10))

story.append(Paragraph("Como acessar o ADM", sSubSecao))
story.append(passo(1, "Na tela de login", "Clique em <b>Acessar ADM</b> abaixo do botão de entrar no PDV."))
story.append(espacar(5))
story.append(passo(2, "Informe a senha ADM", "Digite a senha configurada na instalação do sistema. Apenas usuários com permissão de ADM conseguem acessar."))
story.append(espacar(5))
story.append(passo(3, "Navegue pelas abas", "Use o menu de abas no topo para acessar cada área de configuração."))
story.append(espacar(10))

story.append(aviso("Nunca compartilhe sua senha ADM com operadores de caixa. Use o cadastro de operadores para criar acessos individuais."))

story.append(PageBreak())

# ── Capítulo 4: Produtos ─────────────────────────────
story.append(Paragraph("4. Gerenciando Produtos", sSecao))
story.append(hr())

story.append(Paragraph(
    "Cadastre todos os produtos da sua loja para agilizar as vendas. "
    "Acesse: <b>ADM → 📦 Produtos</b>.", sBody))
story.append(espacar(8))

story.append(Paragraph("Como cadastrar um produto", sSubSecao))
for n, t, d in [
    (1, "Acesse Produtos", "No ADM, clique na aba <b>📦 Produtos</b>."),
    (2, "Clique em Novo Produto", "Botão no canto superior direito da lista."),
    (3, "Preencha os dados", "Informe: <b>Nome</b> (obrigatório), <b>Preço de venda</b>, <b>Unidade</b> (kg, un, cx...) e <b>Categoria</b>."),
    (4, "Salve", "Clique em <b>Salvar</b>. O produto já estará disponível no PDV."),
]:
    story.append(passo(n, t, d))
    story.append(espacar(5))

story.append(espacar(8))
story.append(Paragraph("Campos do produto", sSubSecao))
story.append(tabela_recursos([
    ("Nome",          "Nome exibido no PDV e nos cupons — seja claro e objetivo"),
    ("Preço",         "Preço de venda unitário (ex: R$ 5,99)"),
    ("Unidade",       "kg, g, un, cx, pc, lt, ml — define como o produto é vendido"),
    ("Categoria",     "Frutas, Verduras, Legumes, Outros — facilita a busca no PDV"),
    ("Código/SKU",    "Código interno ou de barras (opcional)"),
    ("Ativo/Inativo", "Produto inativo não aparece no PDV"),
]))
story.append(espacar(10))
story.append(dica("Produtos vendidos por peso (kg) devem ter unidade configurada como 'kg'. Na venda, o operador informa a quantidade pesada."))

story.append(PageBreak())

# ── Capítulo 5: Clientes ─────────────────────────────
story.append(Paragraph("5. Gerenciando Clientes", sSecao))
story.append(hr())

story.append(Paragraph(
    "Cadastre seus clientes para facilitar o atendimento, registrar preferências e "
    "manter histórico de compras. Acesse: <b>ADM → 👤 Clientes</b>.", sBody))
story.append(espacar(8))

story.append(Paragraph("Como cadastrar um cliente", sSubSecao))
for n, t, d in [
    (1, "Acesse Clientes", "No ADM, clique na aba <b>👤 Clientes</b>."),
    (2, "Clique em Novo Cliente", "Preencha nome, telefone e observações."),
    (3, "Salve", "O cliente ficará disponível para ser associado às vendas no PDV."),
]:
    story.append(passo(n, t, d))
    story.append(espacar(5))

story.append(espacar(10))
story.append(dica("Associar o cliente à venda no PDV facilita o histórico de compras e permite consultá-lo depois nos relatórios."))

story.append(PageBreak())

# ── Capítulo 6: Relatórios ────────────────────────────
story.append(Paragraph("6. Relatórios e Fechamento de Caixa", sSecao))
story.append(hr())

story.append(Paragraph(
    "Acompanhe o desempenho da sua loja com relatórios detalhados. "
    "Acesse: <b>ADM → 📊 Relatórios</b>.", sBody))
story.append(espacar(8))

story.append(Paragraph("Relatórios disponíveis", sSubSecao))
story.append(tabela_recursos([
    ("Vendas por período",       "Total de vendas em um intervalo de datas"),
    ("Formas de pagamento",      "Quanto entrou em dinheiro, cartão e Pix"),
    ("Produtos mais vendidos",   "Ranking dos produtos com maior saída"),
    ("Fechamento de caixa",      "Resumo do turno com total de vendas e sangrias"),
], cabecalho=("Relatório", "Descrição")))
story.append(espacar(10))

story.append(Paragraph("Como fechar o caixa", sSubSecao))
for n, t, d in [
    (1, "No PDV", "Clique em <b>🔒 Fechar Caixa</b>."),
    (2, "Confira os totais", "O sistema exibe o resumo do turno: vendas, sangrias e saldo esperado."),
    (3, "Confirme", "Clique em Confirmar Fechamento. O relatório é gerado e impresso automaticamente."),
]:
    story.append(passo(n, t, d))
    story.append(espacar(5))

story.append(PageBreak())

# ── Capítulo 7: Operadores ───────────────────────────
story.append(Paragraph("7. Operadores e Senhas", sSecao))
story.append(hr())

story.append(Paragraph(
    "Cadastre um operador para cada funcionário que usa o caixa. "
    "Cada um terá seu próprio login e permissões específicas. "
    "Acesse: <b>ADM → 👥 Operadores</b>.", sBody))
story.append(espacar(8))

story.append(Paragraph("Permissões disponíveis por operador", sSubSecao))
story.append(tabela_recursos([
    ("Finalizar venda",      "Permite concluir vendas no PDV"),
    ("Cancelar item",        "Remove item de uma venda em andamento"),
    ("Cancelar venda",       "Cancela a venda inteira"),
    ("Aplicar desconto",     "Permite dar descontos nos itens ou na venda"),
    ("Sangria",              "Permite registrar retirada de dinheiro do caixa"),
    ("Relatórios",           "Acesso aos relatórios de vendas"),
    ("Buscar cupons",        "Consulta cupons e vendas anteriores"),
]))
story.append(espacar(10))

story.append(Paragraph("Como redefinir a senha ADM", sSubSecao))
story.append(Paragraph(
    "Na tela de login, clique em <b>Esqueci minha senha</b>. "
    "Informe o usuário ADM cadastrado e defina a nova senha.", sBody))
story.append(espacar(8))
story.append(aviso("A senha ADM dá acesso total ao sistema. Use uma senha forte (mínimo 4 caracteres) e não a compartilhe."))

story.append(PageBreak())

# ── Capítulo 8: Suporte ──────────────────────────────
story.append(Paragraph("8. Solicitando Suporte", sSecao))
story.append(hr())

story.append(Paragraph(
    "Em caso de dúvidas, erros ou sugestões, utilize o canal de suporte "
    "integrado ao sistema. Acesse: <b>ADM → 🆘 Suporte</b>.", sBody))
story.append(espacar(8))

for n, t, d in [
    (1, "Acesse a aba Suporte", "No ADM, clique em <b>🆘 Suporte</b>."),
    (2, "Preencha o formulário", "Informe seu nome, WhatsApp (para retorno), o assunto e descreva detalhadamente o problema ou dúvida."),
    (3, "Clique em Enviar", "Sua solicitação chegará ao suporte. O retorno é feito em até 1 dia útil."),
]:
    story.append(passo(n, t, d))
    story.append(espacar(5))

story.append(espacar(8))
story.append(tabela_recursos([
    ("💬 Dúvida técnica", "Como usar alguma funcionalidade do sistema"),
    ("🐛 Erro no sistema", "Algo não está funcionando corretamente"),
    ("💡 Sugestão",       "Ideia para melhorar o sistema"),
    ("📋 Outro assunto",  "Qualquer outro tema"),
], cabecalho=("Tipo de assunto", "Quando usar")))
story.append(espacar(8))
story.append(dica("Descreva o erro com o máximo de detalhes possível: o que você estava fazendo, qual mensagem apareceu e em qual tela. Isso acelera o atendimento."))

story.append(PageBreak())

# ════════════════════════════════════════════════════════
# PARTE 2 — MASTER
# ════════════════════════════════════════════════════════
story.append(titulo_secao("Parte 2 — Para o Master (Administrador do Sistema)"))
story.append(espacar(14))

story.append(Paragraph("9. Painel Master — Visão Geral", sSecao))
story.append(hr())

story.append(Paragraph(
    "O <b>Painel Master</b> é a área exclusiva do administrador do sistema (você). "
    "Acesse em: <b>horti-gestao.vercel.app/master</b>. "
    "A entrada é protegida por senha master.", sBody))
story.append(espacar(8))

story.append(Paragraph("Abas do Painel Master", sSubSecao))
story.append(tabela_recursos([
    ("👥 Clientes",    "Lista todos os clientes, status de cadastro, presença online e ações"),
    ("🔑 Licenças",    "Sistema antigo de licenças por chave (legado)"),
    ("📬 Suporte",     "Inbox de todas as solicitações de suporte dos clientes"),
], cabecalho=("Aba", "Função")))
story.append(espacar(10))

story.append(Paragraph("Cards de resumo", sSubSecao))
story.append(tabela_recursos([
    ("Total de clientes",       "Quantos clientes estão cadastrados"),
    ("Cadastrados",             "Clientes que já fizeram o setup inicial do sistema"),
    ("⏳ Aguardando cadastro",  "Clientes criados mas que ainda não acessaram e configuraram"),
    ("🟢 Online agora",        "Clientes com o sistema aberto nos últimos 2 minutos"),
]))

story.append(PageBreak())

story.append(Paragraph("10. Cadastrando Novos Clientes", sSecao))
story.append(hr())

story.append(Paragraph(
    "Para liberar o acesso a um novo cliente, cadastre-o no painel master. "
    "O código de ativação gerado é o que o cliente usa na primeira vez.", sBody))
story.append(espacar(8))

for n, t, d in [
    (1, "Acesse Painel Master", "Abra horti-gestao.vercel.app/master e entre com a senha master."),
    (2, "Preencha o formulário", "Informe o <b>Nome do cliente</b>, o <b>Código de ativação</b> (gerado automaticamente ou personalizado) e o <b>WhatsApp</b> (opcional)."),
    (3, "Clique em Criar cliente", "O cliente é criado com status <b>⏳ Pendente</b> — aguardando o primeiro acesso."),
    (4, "Envie as boas-vindas", "Se informou o WhatsApp, clique em <b>💬 Enviar boas-vindas via WhatsApp</b>. A mensagem com o código e o link de acesso é enviada automaticamente."),
    (5, "Aguarde o cadastro", "Quando o cliente acessar o sistema e concluir a configuração, o status muda automaticamente para <b>✅ Cadastrado</b> com a data."),
]:
    story.append(passo(n, t, d))
    story.append(espacar(5))

story.append(espacar(8))
story.append(dica("O código de ativação pode ser qualquer combinação de letras e números. Use algo fácil de comunicar por telefone, ex: JOAO25."))
story.append(espacar(8))

story.append(Paragraph("Status do cliente", sSubSecao))
story.append(tabela_recursos([
    ("⏳ Pendente",    "Cliente criado mas ainda não fez o cadastro inicial"),
    ("✅ dd/mm/aaaa",  "Cadastro concluído — mostra a data em que o cliente configurou"),
    ("🟢 Online",      "Bolinha verde = cliente com o sistema aberto agora"),
    ("⚫ Offline",     "Bolinha cinza = cliente não está usando o sistema no momento"),
]))

story.append(PageBreak())

story.append(Paragraph("11. Monitorando Clientes Online", sSecao))
story.append(hr())

story.append(Paragraph(
    "O sistema atualiza automaticamente a presença dos clientes. "
    "A cada 60 segundos, o sistema do cliente envia um sinal ao servidor. "
    "O painel master verifica esses sinais a cada 30 segundos.", sBody))
story.append(espacar(8))

story.append(tabela_recursos([
    ("🟢 Verde",   "Cliente está com o sistema aberto (PDV ou ADM) nos últimos 2 minutos"),
    ("⚫ Cinza",   "Cliente fechou o navegador ou não usa o sistema há mais de 2 minutos"),
], cabecalho=("Indicador", "Significado")))
story.append(espacar(10))

story.append(dica("A presença funciona tanto no aplicativo desktop quanto no navegador web. Se o cliente minimizar ou trocar de aba, o sinal continua sendo enviado em segundo plano."))
story.append(espacar(14))

story.append(Paragraph("12. Gerenciando Suporte", sSecao))
story.append(hr())

story.append(Paragraph(
    "Quando um cliente enviar uma solicitação de suporte, ela aparece na aba "
    "<b>📬 Suporte</b> com um badge vermelho indicando o número de solicitações abertas.", sBody))
story.append(espacar(8))

story.append(Paragraph("Fluxo de atendimento", sSubSecao))
for n, t, d in [
    (1, "Nova solicitação chega", "O badge vermelho aparece na aba Suporte com o número de solicitações abertas."),
    (2, "Clique na solicitação", "Expanda o card para ver os detalhes: nome, estabelecimento, assunto e mensagem completa."),
    (3, "Marque como Em atendimento", "Clique em <b>⏳ Em atendimento</b> para sinalizar que você viu e está tratando."),
    (4, "Entre em contato", "Se o cliente informou WhatsApp, clique no botão verde para abrir a conversa diretamente."),
    (5, "Marque como Resolvido", "Após resolver, clique em <b>✅ Marcar resolvido</b>. A solicitação sai do contador de abertas."),
]:
    story.append(passo(n, t, d))
    story.append(espacar(5))

story.append(espacar(8))
story.append(tabela_recursos([
    ("🔴 Aberto",           "Solicitação recebida, ainda não atendida"),
    ("🟡 Em atendimento",   "Você está tratando — cliente vê que foi recebido"),
    ("🟢 Resolvido",        "Problema solucionado"),
], cabecalho=("Status", "Significado")))

story.append(espacar(14))
story.append(hr(VERDE, 1.5))
story.append(espacar(8))

story.append(Paragraph("Horti Gestão PDV — Dúvidas? Use a aba 🆘 Suporte dentro do sistema.", sRodape))
story.append(Paragraph("horti-gestao.vercel.app", estilo("link",
    fontName="Helvetica-Bold", fontSize=10, textColor=VERDE, alignment=TA_CENTER)))

# ── Build ──────────────────────────────────────────────────────────────────
doc.build(story, onFirstPage=capa, onLaterPages=cabecalho_rodape)
print(f"PDF gerado: {OUTPUT}")
