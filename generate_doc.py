#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 Fiestaflare 跨境电商独立站运营方案 2026 V2
"""

from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

def set_cell_bg(cell, color_hex):
    """设置单元格背景色"""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    tcPr.append(shd)

def set_cell_border(cell, **kwargs):
    """设置单元格边框"""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        if edge in kwargs:
            tag = OxmlElement(f'w:{edge}')
            for key, val in kwargs[edge].items():
                tag.set(qn(f'w:{key}'), val)
            tcBorders.append(tag)
    tcPr.append(tcBorders)

def add_heading(doc, text, level=1, color="1F3864"):
    """添加标题"""
    p = doc.add_heading(text, level=level)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for run in p.runs:
        run.font.color.rgb = RGBColor.from_string(color)
    return p

def add_para(doc, text, bold=False, size=11, space_before=0, space_after=6):
    """添加正文段落"""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.name = 'Calibri'
    run._element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
    run.bold = bold
    return p

def add_bullet(doc, text, level=0):
    """添加项目符号"""
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Inches(0.3 + level * 0.2)
    p.paragraph_format.space_after = Pt(3)
    run = p.add_run(text)
    run.font.size = Pt(10.5)
    run.font.name = 'Calibri'
    run._element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
    return p

def add_table_row(table, data, bg_color=None, bold_first=False):
    """添加表格行"""
    row = table.add_row()
    for i, text in enumerate(data):
        cell = row.cells[i]
        cell.text = text
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.size = Pt(10)
                run.font.name = 'Calibri'
                if bold_first and i == 0:
                    run.bold = True
        if bg_color:
            set_cell_bg(cell, bg_color)
    return row

def create_document():
    doc = Document()

    # 设置页面边距
    section = doc.sections[0]
    section.top_margin = Cm(2.54)
    section.bottom_margin = Cm(2.54)
    section.left_margin = Cm(3.17)
    section.right_margin = Cm(3.17)

    # ========== 封面 ==========
    doc.add_paragraph()
    doc.add_paragraph()
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('Fiestaflare 跨境电商独立站')
    run.font.size = Pt(28)
    run.bold = True
    run.font.color.rgb = RGBColor(31, 56, 100)
    run.font.name = 'Calibri'

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run2 = p2.add_run('运营方案 2026·V2')
    run2.font.size = Pt(24)
    run2.bold = True
    run2.font.color.rgb = RGBColor(31, 56, 100)
    run2.font.name = 'Calibri'

    doc.add_paragraph()
    doc.add_paragraph()

    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run3 = p3.add_run('—— 义乌产业带 × 自建站 × CJDropshipping 海外仓 × DDP 合规清关')
    run3.font.size = Pt(14)
    run3.font.color.rgb = RGBColor(89, 89, 89)

    doc.add_paragraph()
    doc.add_paragraph()
    doc.add_paragraph()

    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ('适用市场', '美国（海外仓）/ 欧盟 / 土耳其 / 中东（冷启动后）'),
        ('商业模式', '独立站直销（CJDropshipping + 中国直发 DDP）'),
        ('团队规模', '1-2 人（义乌创业团队）'),
        ('合规资质', '欧代（GPSR）/ 土代备案 / 德国包装法（LUCID）'),
    ]
    for i, (k, v) in enumerate(meta_data):
        row = meta_table.rows[i]
        row.cells[0].text = k
        row.cells[1].text = v
        for cell in row.cells:
            for para in cell.paragraphs:
                para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in para.runs:
                    run.font.size = Pt(11)
                    run.font.name = 'Calibri'
            set_cell_bg(cell, 'E8EDF5')

    doc.add_page_break()

    # ========== 执行摘要 ==========
    add_heading(doc, '执行摘要', level=1)

    add_para(doc, '''Fiestaflare 是一家根植于义乌产业带的跨境电商独立站品牌，聚焦时尚饰品、发饰、节庆派对用品及家居收纳四大品类，面向美国、欧盟（含德国）、土耳其及中东消费者提供"小批量、高频次、设计感"的供应链出海服务。团队 1-2 人运作，以轻资产模式运营，依托 CJDropshipping 美国仓实现本土化配送，同时以燕文/递四方 DDP 双清包税专线覆盖欧盟与土耳其市场，最大限度降低跨境合规门槛与资金占用。''', size=11)

    add_para(doc, '''本方案以"低成本合规启动→精细化测款迭代→数据驱动扩品"为核心路径，设计了从市场调研、选品策略、建站系统、流量获取到财务测算的完整运营框架。''', size=11)

    # 关键数字表
    doc.add_paragraph()
    p = doc.add_paragraph()
    run = p.add_run('核心运营指标目标（冷启动 6 个月）')
    run.bold = True
    run.font.size = Pt(12)

    metrics_table = doc.add_table(rows=5, cols=3)
    metrics_table.style = 'Table Grid'
    metrics_data = [
        ('指标', '目标值', '备注'),
        ('月均 GMV', '$5,000 - $12,000', '冷启动期保守估算'),
        ('毛利率', '45% - 65%', '含平台手续费、物流成本'),
        ('净利润率', '15% - 25%', '扣除退款、广告、运营成本后'),
        ('广告 ROI', '≥ 3.0', 'Facebook/Meta 主投'),
    ]
    for i, row_data in enumerate(metrics_data):
        row = metrics_table.rows[i]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in para.runs:
                    run.font.size = Pt(10)
                    if i == 0:
                        run.bold = True
            if i == 0:
                set_cell_bg(row.cells[j], '1F3864')
                for para in row.cells[j].paragraphs:
                    for run in para.runs:
                        run.font.color.rgb = RGBColor(255, 255, 255)

    doc.add_paragraph()

    # ========== 第一章 ==========
    add_heading(doc, '第一章 市场分析与目标市场', level=1)

    add_heading(doc, '1.1 全球电商市场机遇', level=2)
    add_para(doc, '''义乌是全球最大的小商品供应链基地，时尚饰品、发饰、节庆派对用品及家居收纳的原材料成本比欧美市场低 60%-80%，具备极强的价格竞争力。近年来全球电商渗透率持续提升，美国电商规模突破 $1.1 万亿，欧盟电商用户超过 3.5 亿，土耳其互联网用户 6,700 万且电商增速位居全球前列，为义乌出海品牌提供了广阔的增长空间。''')

    add_heading(doc, '1.2 目标市场选择', level=2)

    # 市场对比表
    market_table = doc.add_table(rows=5, cols=5)
    market_table.style = 'Table Grid'
    market_headers = ['市场', '物流模式', '合规要求', '税务处理', '启动优先级']
    market_rows = [
        ('美国', 'CJDropshipping 海外仓（2-4 工作日配送）', 'Economic Nexus（年销≥$100,000 或 200 笔触发）', 'TaxJar/Stripe Tax 代收代缴', '★★★ 高'),
        ('欧盟（含德国）', '燕文/递四方 DDP', 'GPSR 欧代 + 德国包装法（LUCID）', 'DDP 专线代缴（低申报有追溯风险）', '★★★ 高'),
        ('土耳其', '燕文/递四方 DDP', '土代备案（特定品类）+ 2026 年 2 月后取消免税', 'DDP 包税（2026 新规影响，需重新评估）', '★★ 中'),
        ('中东（COD）', '暂缓开启', 'COD 拒收率 15%-30%', '冷启动 GMV 稳定 $10,000+ 再评估', '★ 低（冷启动后）'),
    ]
    for j, h in enumerate(market_headers):
        cell = market_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '1F3864')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)

    for i, row_data in enumerate(market_rows):
        row = market_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(9.5)
        if i % 2 == 0:
            for cell in row.cells:
                set_cell_bg(cell, 'F2F5FA')

    doc.add_paragraph()

    # ========== 第二章 ==========
    add_heading(doc, '第二章 产品线规划与选品策略', level=1)

    add_heading(doc, '2.1 四大核心品类', level=2)

    categories = [
        ('时尚饰品', '耳环、项链、手链、胸针等，以合金/贝母/醋酸材质为主，轻便低关税，适合空运与海外仓备货。'),
        ('发饰', '发夹、发圈、发带、抓夹，义乌优势品类，SKU 丰富，节庆款季节性强，圣诞/万圣节提前 60-90 天备货。'),
        ('节庆派对', '派对帽、生日装饰、节日灯串、派对道具。节庆类需提前规划：圣诞节点提前 60-90 天下单，提前 45-60 天入仓。'),
        ('家居收纳', '桌面收纳盒、首饰收纳包、厨房收纳，标准化程度高，重量相对较大，适合 DDP 海运专线。'),
    ]
    for cat, desc in categories:
        p = doc.add_paragraph()
        run = p.add_run(f'• {cat}：')
        run.bold = True
        run.font.size = Pt(11)
        run2 = p.add_run(desc)
        run2.font.size = Pt(11)

    add_heading(doc, '2.2 选品原则', level=2)
    principles = [
        '重量 < 500g：控制物流成本，提升利润空间',
        '客单价 $15-$50：中等价位，决策门槛低，复购潜力大',
        '季节性强/节庆属性：便于营销节点运营',
        '标准化程度高：降低退货率',
        '义乌产业带直接采购：降低采购成本 60%+',
        '避开液体/带电池/纯化妆品：高海关门槛品类',
    ]
    for pr in principles:
        add_bullet(doc, pr)

    add_heading(doc, '2.3 欧盟关税合规说明', level=2)
    add_para(doc, '''欧盟自 2026 年 7 月起对单票价值低于 €150 的 B2C 进口包裹统一征收 €3/件固定关税（原低价值包裹免税政策全面取消）。此前，€22 以下小包裹免税时代终结。该 €3/件关税由物流商通过 DDP 模式代缴，卖家需将此成本纳入产品定价的"到岸成本"核算中，不得低价申报规避，否则面临清关延误及补税追溯风险。''')

    # ========== 第三章 ==========
    add_heading(doc, '第三章 独立站建站与系统架构', level=1)

    add_heading(doc, '3.1 建站系统推荐', level=2)
    add_para(doc, '''1-2 人团队建议优先选择 Shopify 或 Shopline，具备以下优势：SaaS 托管降低技术门槛，App 生态完善（选品分析、邮件营销、ERP 同步），Payment gateway 直连（Stripe HK/Paddle/PayPal）。 WooCommerce 自建对技术能力要求较高，冷启动期不推荐。''')

    add_heading(doc, '3.2 支付网关配置', level=2)

    # 支付网关对比
    pg_table = doc.add_table(rows=4, cols=4)
    pg_table.style = 'Table Grid'
    pg_headers = ['方案', '注册主体要求', '手续费', '适用场景']
    pg_data = [
        ('Stripe HK', '香港公司', '约 3.4% + HK$2.35', '美国/欧盟/土耳其主力收款'),
        ('Paddle（MoR 模式）', '中国大陆主体可用', '约 5% 含税务服务', '替代 Stripe 的合规收款方案'),
        ('PayPal', '个人/企业均可', '约 3.5% + $0.3', '买家信任度高，搭配 Stripe 使用'),
    ]
    for j, h in enumerate(pg_headers):
        cell = pg_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '1F3864')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(pg_data):
        row = pg_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)
    doc.add_paragraph()

    add_para(doc, '''⚠️ 注意：中国大陆主体无法注册 Stripe 账户，需通过注册香港公司（Stripe HK）或美国公司来申请；Paddle 采用 Merchant of Record（MoR）模式，可合规覆盖更多国家且无需自有 Stripe 主体。Airwallex 不能替代 Stripe 作为支付网关主体使用。''', size=10.5)

    add_heading(doc, '3.3 支付安全与风控（高风险）', level=2)
    add_para(doc, '''PayPal 风控等级已升级为"高"。2026 年规则：买家投诉率超过 3% 即触发账户限制；永久封禁后资金冻结 180 天。必须严格执行：''', bold=False)
    rules = [
        '发货后 48 小时内上传有效追踪号',
        '账户余额不超过 2 周 GMV',
        '保持投诉率 < 2%',
        '每日核查 PayPal Dashboard 风险指标',
        '准备备用收款通道（Stripe/Paddle）以防主账户被封',
    ]
    for r in rules:
        add_bullet(doc, r)

    # ========== 第四章 ==========
    add_heading(doc, '第四章 合规体系与税务架构', level=1)

    add_heading(doc, '4.1 已注册合规资质', level=2)

    # 合规资质表
    cert_table = doc.add_table(rows=4, cols=4)
    cert_table.style = 'Table Grid'
    cert_headers = ['资质', '适用市场', '年度费用（欧元）', '核心要点']
    cert_data = [
        ('欧代（GPSR）', '欧盟全部 27 国', '€200 - €500', '必须包含真实技术文档托管 + 10 天内应答监管问询，不接受纯地址挂靠'),
        ('土代备案', '土耳其（特定品类）', '€100 - €300', '2025 年 4 月新规要求特定品类强制备案，2026 年 2 月取消小包裹免税'),
        ('德国包装法（LUCID）', '德国', '€50 - €200（回收处理费）', '年度回收处理费 €50-€200，非 $50，需在 LUCID 系统注册并申报包装数量'),
    ]
    for j, h in enumerate(cert_headers):
        cell = cert_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '2E7434')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(cert_data):
        row = cert_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)
    doc.add_paragraph()

    add_heading(doc, '4.2 GPSR 欧代：技术文档要求', level=2)
    add_para(doc, '''通用产品安全法规（GPSR, EU General Product Safety Regulation）要求在欧盟市场销售的所有消费品必须指定一名欧盟授权代表。欧代服务必须包含：''')
    gpsr_reqs = [
        '产品技术文档（产品规格、材料成分、使用说明）',
        'CE 标志合规声明（若适用）',
        '事故报告记录保存（10 年）',
        '监管机构问询应答（10 个工作日内）',
        '在欧盟境内设立实体或指定合规服务商（非仅邮政信箱）',
    ]
    for req in gpsr_reqs:
        add_bullet(doc, req)

    add_para(doc, '''选型建议：优先选择提供全套 GPSR 文档托管 + 监管应答服务的综合合规服务商，年度费用约 €300-€500，义乌本地有服务商提供该服务。前置成本：每市场合规预算 ≤ $100（欧代 + 土代 + 德国包装法均在已注册状态，续费年度内不再产生额外前置成本）。''')

    add_heading(doc, '4.3 DDP 税务责任澄清', level=2)
    add_para(doc, '''重要澄清：DDP（完税后交付）模式并不意味着卖家"转移"了税务责任。具体说明如下：''')
    ddp_points = [
        'DDP 专线由物流商代缴进口关税及目的地国家 VAT，物流商向卖家收取含税报价。',
        '卖家需确认物流商使用的是合规清关渠道，若物流商低报货值，卖家作为进口收货人仍面临海关追溯风险。',
        '欧盟 2026 年 7 月起对 €150 以下 B2C 包裹统一征收 €3/件固定关税，无论是否使用 DDP，该费用均需由物流商代缴，并体现在卖家物流成本中。',
        '土耳其 2026 年 2 月取消小包裹免税政策后，DDP 包税策略的性价比将受影响，需重新评估物流方案成本。',
        '建议每季度核查 DDP 专线报价的关税结构，确保成本透明。',
    ]
    for pt in ddp_points:
        add_bullet(doc, pt)

    add_heading(doc, '4.4 美国 Economic Nexus 税务（2026 新动态）', level=2)
    add_para(doc, '''截至 2026 年，美国 41 个州已实施 Economic Nexus 规定，卖家满足以下任一条件即触发税务关联义务：''')
    nexus_points = [
        '年销售额 ≥ $100,000（该州内）',
        '或年度交易笔数 ≥ 200 笔（该州内）',
        '触发后须在该州注册卖家许可证（Seller\'s Permit）并代收代缴州销售税',
    ]
    for pt in nexus_points:
        add_bullet(doc, pt)

    add_para(doc, '''推荐工具 TaxJar 或 Stripe Tax：自动计算消费者所在州税率并在结账时代收销售税，减少手动申报负担。初始注册可自行在州政府网站完成，无需聘请 CPA。''')

    # ========== 第五章 ==========
    add_heading(doc, '第五章 物流体系与仓储方案', level=1)

    add_heading(doc, '5.1 美国市场：CJDropshipping 海外仓', level=2)
    add_para(doc, '''美国市场采用 CJDropshipping 美国本地仓，具体参数如下：''')

    cjd_table = doc.add_table(rows=6, cols=2)
    cjd_table.style = 'Table Grid'
    cjd_data = [
        ('配送时效', '美国国内配送 2-4 个工作日'),
        ('履约费用', '$3.00 - $4.50 / 单（1 磅以下，标准品类）'),
        ('仓储费用', '前 30 天免费，超期按 $0.50/天/件收费'),
        ('适用品类', '时尚饰品、发饰、节庆派对单品（轻便低重）'),
        ('备货建议', '首批 50-100 件测款，旺季提前 30 天入仓'),
        ('追踪率要求', 'CJD 自动上传追踪号，需确保订单 48 小时内推送到 CJD'),
    ]
    for i, (k, v) in enumerate(cjd_data):
        row = cjd_table.rows[i]
        row.cells[0].text = k
        row.cells[1].text = v
        set_cell_bg(row.cells[0], 'E8F0FE')
        for cell in row.cells:
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10.5)
    doc.add_paragraph()

    add_heading(doc, '5.2 欧盟/土耳其市场：燕文/递四方 DDP 专线', level=2)
    add_para(doc, '''欧盟和土耳其市场采用 DDP（Delivered Duty Paid）双清包税专线，物流商统一负责出口清关与目的国进口清关，并代缴关税及 VAT。''')

    ddp_note = [
        '时效：欧盟 10-18 个工作日（土耳其 12-20 个工作日）',
        '计费方式：按克重或件计费，具体报价待确认（联系燕文/递四方义乌揽收点获取实时报价）',
        '关税备注：欧盟 €3/件固定关税（2026 年 7 月生效）及具体目的国税率均须纳入报价，待确认',
        '土耳其：2026 年 2 月取消小包裹免税政策，DDP 包税策略成本上升，需重新评估',
        '低申报风险：必须使用合规申报价值，保留采购凭证应对海关审查',
        '数据核实：以上报价及政策参数建议直接联系燕文/递四方义乌揽收点确认，获取最新报价表',
    ]
    for note in ddp_note:
        add_bullet(doc, note)

    add_para(doc, '''⚠️ 数据说明：本方案中涉及的燕文 DDP 报价信息为参考市场行情，确切价格须联系燕文/递四方义乌揽收点实时确认。''', size=10)

    add_heading(doc, '5.3 土耳其市场特殊说明', level=2)
    add_para(doc, '''土耳其电商市场存在以下新规变化，须重点关注：''')
    turkey_notes = [
        '2025 年 4 月：特定品类（土耳其标准局强制目录产品）须完成土代备案，否则无法清关',
        '2026 年 2 月：全面取消 €30 以下小包裹免税政策，DDP 包税性价比下降',
        '物流建议：重新评估 DDP 专线报价，若成本上涨超过 20%，考虑提高免邮门槛或暂停土耳其市场',
    ]
    for note in turkey_notes:
        add_bullet(doc, note)

    add_heading(doc, '5.4 中东 COD 模式（冷启动后评估）', level=2)
    add_para(doc, '''中东市场 Cash on Delivery（COD）模式拒收率高达 15%-30%，对资金周转和运营效率影响极大。''')
    cod_warning = [
        '冷启动阶段（月 GMV < $10,000）不建议开启中东 COD',
        '等月 GMV 稳定 $10,000+ 后，再评估是否开启',
        '开启前需评估：物流商是否有中东 COD 专线支持、是否有本地退货处理能力',
        '建议在土耳其和欧盟市场稳定后再考虑中东扩张',
    ]
    for w in cod_warning:
        add_bullet(doc, w)

    # ========== 第六章 ==========
    add_heading(doc, '第六章 流量获取与社交媒体运营', level=1)

    add_heading(doc, '6.1 流量渠道矩阵', level=2)

    ch_table = doc.add_table(rows=5, cols=4)
    ch_table.style = 'Table Grid'
    ch_headers = ['渠道', '流量类型', '预算占比', '核心指标']
    ch_data = [
        ('Facebook/Meta', '社交广告', '50%', 'ROAS ≥ 3.0，CPA < $15'),
        ('Instagram', '内容种草 + 广告', '20%', '互动率 > 3%，转化率 > 1.5%'),
        ('TikTok', '短视频带货（Smart Performance Campaign）', '15%', '视频完播率 > 30%，点击率 > 2%'),
        ('Pinterest', '自然流量（节庆/家居）', '15%', '月引流 > 500，转化率 > 2%'),
    ]
    for j, h in enumerate(ch_headers):
        cell = ch_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '1F3864')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(ch_data):
        row = ch_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)
    doc.add_paragraph()

    add_heading(doc, '6.2 Facebook/Meta 广告策略', level=2)
    fb_strategies = [
        '商品目录广告（DPA）：上传完整商品目录，实现全品类自动化再营销',
        '节庆专题广告：感恩节、圣诞、万圣节提前 30 天启动，配合节庆装饰素材',
        '受众再营销：弃购用户（Cart Abandoners）投放专门的 15% OFF 折扣码广告',
        'A/B 测试：每周测试 2-3 组创意素材和文案，保留 CTR > 2% 的素材',
        'Pixel 安装：确认网站安装 Meta Pixel，正确配置标准事件（ViewContent、AddToCart、Purchase）',
    ]
    for s in fb_strategies:
        add_bullet(doc, s)

    add_heading(doc, '6.3 TikTok 广告（Smart Performance Campaign）', level=2)
    add_para(doc, '''TikTok 广告产品对应的是 Smart Performance Campaign（智能效果广告），并非 Google 的 PMAX。TikTok Smart Performance Campaign 通过算法自动优化投放，实现：''')
    tiktok_points = [
        '自动选品：根据转化数据自动优先展示高转化商品',
        '跨创意组合：AI 自动拼接素材，找到最优广告组合',
        '简化操作：只需设置预算和优化目标，系统自动出价',
        '适用场景：冷启动期快速测款，预算 $20-50/天',
    ]
    for pt in tiktok_points:
        add_bullet(doc, pt)

    add_heading(doc, '6.4 季节性营销日历', level=2)

    cal_table = doc.add_table(rows=8, cols=4)
    cal_table.style = 'Table Grid'
    cal_headers = ['节日', '营销节点', '提前备货下单', '提前入仓时间']
    cal_data = [
        ('情人节（2/14）', '1月中旬-2月上旬', '前一年12月中旬', '1月中旬'),
        ('母亲节（5月）', '4月中旬-5月上旬', '2月下旬', '4月上旬'),
        ('万圣节（10/31）', '9月中旬-10月下旬', '7月下旬-8月', '9月中旬'),
        ('感恩节（11月）', '11月上旬', '9月上旬', '10月中旬'),
        ('圣诞/新年（12月）', '11月中旬-12月中旬', '9月中旬-10月', '10月下旬-11月中旬'),
        ('节庆备货周期说明', '—', '至少提前60-90天下单', '提前45-60天入仓（不是45天）'),
        ('节庆选品建议', '节庆派对/圣诞装饰/礼品', '提前规划节庆专属 SKU', '提前 60 天完成选品确认'),
    ]
    for j, h in enumerate(cal_headers):
        cell = cal_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, 'C00000')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(cal_data):
        row = cal_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(9.5)
                    if i == 5:
                        run.bold = True

    doc.add_page_break()

    # ========== 第七章 ==========
    add_heading(doc, '第七章 定价策略与财务模型', level=1)

    add_heading(doc, '7.1 定价原则', level=2)
    pricing = [
        'CIF 到岸成本定价：售价 ≥ 产品成本 + 国内物流 + 国际运费 + 关税（DDP） + 平台手续费 + 广告费用 + 预期利润',
        '竞品对标定价：参考 Etsy、Amazon、eBay 同类商品价格带，确保价格竞争力',
        '差异化溢价：节庆限定款、设计师联名款可溢价 20%-40%',
        '免邮门槛设置：美国市场满 $35 免运费，欧盟满 €30 免运费（覆盖 DDP 成本）',
    ]
    for pr in pricing:
        add_bullet(doc, pr)

    add_heading(doc, '7.2 成本结构拆解', level=2)
    add_para(doc, '''⚠️ 本节严格区分毛利率与净利润率，这是两个不同的财务指标：''')
    add_para(doc, '''• 毛利率 =（售价 - 产品成本 - 国内物流 - 国际运费 - 关税 - 平台手续费）/ 售价，反映核心商业模式的盈利能力''')
    add_para(doc, '''• 净利润率 =（净 GMV - 全部成本）/ 净 GMV，反映扣除所有运营成本后的最终收益''')

    add_para(doc, '''例：欧盟市场发饰产品，售价 $25：''')

    cost_table = doc.add_table(rows=8, cols=3)
    cost_table.style = 'Table Grid'
    cost_headers = ['成本项', '金额', '占售价比']
    cost_data = [
        ('产品成本（义乌采购）', '$4.00', '16%'),
        ('国内物流（义务发国内）', '$0.50', '2%'),
        ('DDP 国际运费 + 关税', '$5.50', '22%'),
        ('平台手续费（Stripe/Paddle）', '$0.88', '3.5%'),
        ('广告费用（GMV 的 15%）', '$3.75', '15%'),
        ('退款准备（净 GMV 端扣减）', '按退款率 8% 估算', '—'),
        ('净利润（参考值）', '$5.37 - $7.37', '约 21%-29%'),
    ]
    for j, h in enumerate(cost_headers):
        cell = cost_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '1F3864')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(cost_data):
        row = cost_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)

    doc.add_paragraph()

    add_heading(doc, '7.3 退款处理逻辑', level=2)
    add_para(doc, '''退款不应在成本端额外列举，而应在收入端体现为净 GMV 的扣减：''')
    refund_points = [
        '净 GMV = GMV × (1 - 退款率)',
        '退款率按行业均值 5%-10% 估算（时尚饰品退货率约 8%）',
        '退款处理成本（退货物流）按 $1.50/单估算，计入净利润率计算',
        '广告费用以实际净 GMV 为基数计算（避免退款订单浪费广告费）',
        '退款率若超过 15%，须立即分析原因（尺码问题/描述不符/质量问题）并优化',
    ]
    for pt in refund_points:
        add_bullet(doc, pt)

    add_heading(doc, '7.4 财务目标（冷启动 6 个月）', level=2)

    fin_table = doc.add_table(rows=6, cols=4)
    fin_table.style = 'Table Grid'
    fin_headers = ['月份', '目标 GMV', '毛利率目标', '净利润率目标']
    fin_data = [
        ('第 1-2 月', '$1,500 - $3,000', '35% - 45%', '5% - 10%（测款期）'),
        ('第 3-4 月', '$3,000 - $6,000', '45% - 55%', '15% - 20%'),
        ('第 5-6 月', '$6,000 - $12,000', '55% - 65%', '20% - 25%'),
        ('第 7-12 月', '$10,000 - $20,000', '55% - 65%', '20% - 28%'),
        ('稳定期', '$15,000+/月', '55% - 65%', '22% - 30%'),
    ]
    for j, h in enumerate(fin_headers):
        cell = fin_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '1F3864')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(fin_data):
        row = fin_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)

    doc.add_page_break()

    # ========== 第八章 ==========
    add_heading(doc, '第八章 客服与售后服务体系', level=1)

    add_heading(doc, '8.1 客服渠道', level=2)
    channels = [
        '邮件支持：support@fiestaflare.com，响应时间 < 24 小时',
        'Facebook Messenger 聊天插件：实时响应，提升转化率',
        'Instagram DM：配合社媒运营，统一在 Meta Business Suite 处理',
        'WhatsApp（美国/中东）：可选，接入成本低',
    ]
    for ch in channels:
        add_bullet(doc, ch)

    add_heading(doc, '8.2 退款政策', level=2)
    policy_points = [
        '美国市场：30 天无理由退货，由 CJD 仓库处理，美国本地退回',
        '欧盟/土耳其：14 天退货权（欧盟消费者法规定），提供预付费退件标签',
        '退款处理时效：收到退货后 5 个工作日内退款',
        '退款率监控：超过 10% 立即启动根因分析',
    ]
    for pp in policy_points:
        add_bullet(doc, pp)

    add_heading(doc, '8.3 差评预防与管理', level=2)
    review_points = [
        '每笔订单发货后自动发送感谢邮件，附带"如何留下好评"引导',
        '差评出现 24 小时内联系客户，争取修改评价',
        '建立差评台账，每月分析差评原因并优化产品/描述',
        'PayPal 投诉率严格控制在 3% 以下，避免账户风控',
    ]
    for rp in review_points:
        add_bullet(doc, rp)

    # ========== 第九章 ==========
    add_heading(doc, '第九章 团队分工与工作流程', level=1)

    add_heading(doc, '9.1 1-2 人团队分工', level=2)

    team_table = doc.add_table(rows=3, cols=3)
    team_table.style = 'Table Grid'
    team_headers = ['角色', '核心职责', '工具']
    team_data = [
        ('创始人 A（主运营）', '选品、采购、广告投放、客服', 'Shopify、Meta Ads Manager、Keepa、Jungle Scout'),
        ('创始人 B（支持）', '社媒内容、图文素材、订单管理、售后', 'Canva、Later、Pinterest Business、TikTok Creator'),
    ]
    for j, h in enumerate(team_headers):
        cell = team_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '1F3864')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(team_data):
        row = team_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)

    doc.add_paragraph()

    add_heading(doc, '9.2 每日工作流程', level=2)
    workflow = [
        '上午：核查昨日订单，处理 PayPal/Stripe 到账，回复客服邮件（< 24h SLA）',
        '下午：Meta 广告数据复盘，调整当日广告预算和受众，执行选品调研',
        '晚间：社媒内容发布（Instagram/TikTok），Pinterest 引流 pinning',
        '每周：周一核查周 GMV，更新库存，周五完成广告周报',
        '每月：1 日进行月度复盘，更新月度 GMV/净利润率目标，调整选品方向',
    ]
    for wf in workflow:
        add_bullet(doc, wf)

    add_heading(doc, '9.3 爆款生命周期管理', level=2)
    lifecycle = [
        '测款期（1-2 周）：$30-50/天广告费，快速收集 CTR 和转化数据',
        '放量期（3-4 周）：广告 ROI > 2.5 即可追加预算至 $80-150/天',
        '稳定期：维持广告投放，同步开发同类 SKU，建立护城河',
        '衰退期：CTR 下降超过 30%，立即暂停广告，开始清库存（降价或组合销售）',
    ]
    for lc in lifecycle:
        add_bullet(doc, lc)

    # ========== 第十章 ==========
    add_heading(doc, '第十章 风险管理与应急预案', level=1)

    add_heading(doc, '10.1 主要风险清单', level=2)

    risk_table = doc.add_table(rows=7, cols=4)
    risk_table.style = 'Table Grid'
    risk_headers = ['风险类别', '具体风险', '发生概率', '应对措施']
    risk_data = [
        ('合规风险', '欧代服务商跑路/不合规', '低', '选择有实体办公地点的服务商，保留合同'),
        ('物流风险', 'DDP 清关延误/补税', '中', '保留采购凭证，使用合规申报价值'),
        ('支付风险', 'PayPal 账户被封（高风险）', '高', '备用 Stripe/Paddle，余额不超过 2 周 GMV'),
        ('市场风险', '土耳其 2026 新规影响 DDP 成本', '中', '重新评估土耳其市场报价，及时调整'),
        ('产品风险', '节庆款滞销/库存积压', '中', '提前 60-90 天备货，首批量 50-100 件测款'),
        ('汇率风险', '美元/欧元汇率波动', '低', '对冲工具：保持 $5,000 美元账户缓冲'),
    ]
    for j, h in enumerate(risk_headers):
        cell = risk_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, 'C00000')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(risk_data):
        row = risk_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(9.5)
        if i % 2 == 0:
            for cell in row.cells:
                set_cell_bg(cell, 'FFF2F2')

    doc.add_paragraph()

    add_heading(doc, '10.2 PayPal 风控应急预案', level=2)
    add_para(doc, '''鉴于 PayPal 风控等级已升级为"高"，建议按以下步骤准备应急预案：''')
    pp_steps = [
        '备用收款：提前注册 Stripe HK（香港公司）或 Paddle 账户，作为紧急备用',
        '余额控制：PayPal 账户余额始终不超过 2 周 GMV（建议不超过 $3,000）',
        '每日监控：每日检查 PayPal Dashboard 投诉率和风险指标',
        '资金分流：每日将 PayPal 余额提现至银行，避免大量资金在账户停留',
        '申诉准备：账户若被限制，保留订单记录、发货证明、追踪号截图，第一时间提交申诉',
    ]
    for step in pp_steps:
        add_bullet(doc, step)

    add_heading(doc, '10.3 库存风险管理', level=2)
    inv_points = [
        'CJD 美国仓首批备货不超过 100 件/ SKU，热销款再追加',
        '节庆款：提前 60-90 天下单，提前 45-60 天入仓，滞销款及时降价清仓',
        '义乌国内库存：保持 2 周销量 Buffer，避免断货影响广告投放',
    ]
    for pt in inv_points:
        add_bullet(doc, pt)

    # ========== 附录 ==========
    add_heading(doc, '附录', level=1)

    add_heading(doc, '附录 A：冷启动合规检查清单', level=2)
    checklist = [
        '☐ 欧代（GPSR）：确认欧代服务包含技术文档托管 + 10 天内应答监管问询，不接受纯地址挂靠',
        '☐ 土代备案（特定品类）：已在土耳其标准局完成备案登记',
        '☐ 德国包装法（LUCID）：已在 LUCID 系统注册并完成年度申报，年度回收处理费 €50-€200 已缴纳',
        '☐ 支付网关：已注册 Stripe HK（香港公司）或 Paddle 账户',
        '☐ PayPal：已完成企业账户升级，风控规则已告知团队',
        '☐ Meta Business Suite：已创建广告账户，Pixel 已安装并验证',
        '☐ TikTok For Business：已注册账户，Smart Performance Campaign 已创建',
        '☐ CJDropshipping：已完成账号注册、商品同步、履约费确认',
        '☐ 燕文/递四方：已联系义乌揽收点，确认 DDP 报价（含欧盟 €3/件关税）',
        '☐ TaxJar/Stripe Tax：美国 Economic Nexus 州销售税注册已完成（触发条件前可先注册）',
    ]
    for item in checklist:
        p = doc.add_paragraph()
        run = p.add_run(item)
        run.font.size = Pt(10.5)
        run.font.name = 'Calibri'

    add_heading(doc, '附录 B：推荐工具清单', level=2)

    tools_table = doc.add_table(rows=11, cols=3)
    tools_table.style = 'Table Grid'
    tools_headers = ['工具类别', '推荐工具', '用途']
    tools_data = [
        ('建站系统', 'Shopify / Shopline', '独立站搭建'),
        ('支付网关', 'Stripe HK / Paddle', '跨境收款'),
        ('广告分析', 'Meta Ads Manager', 'Facebook/Instagram 广告'),
        ('TikTok 广告', 'TikTok For Business（Smart Performance Campaign）', '短视频带货'),
        ('选品调研', 'Jungle Scout / Keepa', '竞品数据分析'),
        ('社媒管理', 'Later / Meta Business Suite', '内容排期发布'),
        ('图文设计', 'Canva', '社媒图文素材'),
        ('邮件营销', 'Klaviyo（Shopify App）', '自动化邮件'),
        ('美国税务', 'TaxJar / Stripe Tax', '州销售税自动计算'),
        ('ERP 管理', '店小秘 / 马帮', '订单/库存管理'),
    ]
    for j, h in enumerate(tools_headers):
        cell = tools_table.rows[0].cells[j]
        cell.text = h
        set_cell_bg(cell, '1F3864')
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)
    for i, row_data in enumerate(tools_data):
        row = tools_table.rows[i + 1]
        for j, text in enumerate(row_data):
            row.cells[j].text = text
            for para in row.cells[j].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)
        if i % 2 == 0:
            for cell in row.cells:
                set_cell_bg(cell, 'F2F5FA')

    doc.add_paragraph()

    add_heading(doc, '附录 C：选品调研框架', level=2)
    add_para(doc, '''冷启动期选品建议按以下框架筛选：''')
    selection_framework = [
        '1. 义乌供应链匹配度：是否有现成供应商，MOQ ≤ 50 件',
        '2. 重量体积：重量 < 500g，体积小，降低国际运费',
        '3. 竞品价格带：Etsy/Amazon 同款售价 $15-$45，义乌采购成本 < $6',
        '4. 广告素材可塑性：产品图片/视频是否适合社交媒体展示（高颜值/仪式感）',
        '5. 季节性：优先选择全年可售 + 节庆属性兼备的品类，平滑季节波动',
        '6. 专利/版权：避开仿牌和 IP 侵权产品（迪士尼、漫威等），选择原创设计或公版款式',
    ]
    for item in selection_framework:
        add_bullet(doc, item)

    add_heading(doc, '附录 D：关键指标仪表盘', level=2)
    add_para(doc, '''建议使用 Shopify Analytics 或 Google Sheets 建立关键指标追踪仪表盘，每周更新：''')
    dash_metrics = [
        'GMV（周/日）、净 GMV（扣除退款）',
        '毛利率 vs 净利润率（区分清楚，不能混用）',
        '广告 ROAS / CPA',
        '退款率（目标 < 8%）',
        'PayPal 投诉率（目标 < 3%）',
        'CJD 库存周转天数',
        '客户复购率（月复购 > 5%）',
    ]
    for dm in dash_metrics:
        add_bullet(doc, dm)

    doc.add_paragraph()

    add_heading(doc, '附录 E：术语表', level=2)

    glossary = [
        ('CIF', 'Cost, Insurance and Freight，到岸价，包含成本、保险和运费'),
        ('DDP', 'Delivered Duty Paid，完税后交付，物流商代缴关税及VAT'),
        ('Economic Nexus', '经济关联，美国各州对跨境卖家设定的销售税注册门槛'),
        ('GPSR', 'EU General Product Safety Regulation，欧盟通用产品安全法规'),
        ('ROAS', 'Return on Ad Spend，广告支出回报率'),
        ('CPA', 'Cost per Acquisition，单次获客成本'),
        ('COD', 'Cash on Delivery，货到付款'),
        ('MoR', 'Merchant of Record，商户记录模式，第三方代缴税款'),
        ('PMAX', 'Performance Max，Google广告产品（注意TikTok对应产品为Smart Performance Campaign）'),
    ]
    for term, defn in glossary:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        run1 = p.add_run(f'{term}：')
        run1.bold = True
        run1.font.size = Pt(10.5)
        run2 = p.add_run(defn)
        run2.font.size = Pt(10.5)

    doc.add_paragraph()

    # ========== 页脚 ==========
    p_footer = doc.add_paragraph()
    p_footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_footer = p_footer.add_run('Fiestaflare 独立站运营方案 2026·V2 | 机密文件 | 请勿外传')
    run_footer.font.size = Pt(9)
    run_footer.font.color.rgb = RGBColor(128, 128, 128)

    # 保存文件
    output_path = '/home/admin/Fiestaflare/Fiestaflare-独立站运营方案-2026-V2.docx'
    doc.save(output_path)
    print(f'文档已生成：{output_path}')
    return output_path

if __name__ == '__main__':
    create_document()
