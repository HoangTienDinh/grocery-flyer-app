import { useEffect, useMemo, useState } from 'react'
import { Layer, Rect, Text as KText, Group, Image as KImage, Line, Circle } from 'react-konva'
import useImage from 'use-image'
import { driveImageCandidates } from '../utils/drive'
import { clamp } from '../utils/format'
import type { FeaturedItem, Row } from '../utils/xlsx'
import { resolveTokenToObjectUrl } from '../utils/media'
import type { Theme } from './DesignPanel'

export const CANVAS_W = 2550
export const CANVAS_H = 3300
const MARGIN = 120
const ROW_SIDE_INSET = 60 // px per side to narrow rows under the header

/** Resolve either media:// or asset:// tokens, or regular URLs */
function useResolvedUrl(raw: string) {
  const [url, setUrl] = useState<string>('')

  useEffect(() => {
    let revoke: string | undefined

    ;(async () => {
      if (!raw) { setUrl(''); return }

      // resolve app tokens
      if (raw.startsWith('media://') || raw.startsWith('asset://')) {
        const obj = await resolveTokenToObjectUrl(raw)
        if (obj) {
          setUrl(obj)
          // only revoke blob: URLs we create; asset URLs (http/file) shouldn’t be revoked
          if (obj.startsWith('blob:')) revoke = obj
        } else {
          setUrl('')
        }
        return
      }

      // passthrough http(s) and other direct URLs
      setUrl(raw)
    })()

    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [raw])

  return url
}

function NetworkImage({
  url, x, y, w, h, padding = 0,
}: { url: string; x: number; y: number; w: number; h: number; padding?: number }) {
  const resolved = useResolvedUrl(url)
  const candidates = useMemo(
    () => (resolved && resolved.startsWith('http') ? [resolved] : driveImageCandidates(resolved || '')),
    [resolved]
  )
  const [i, setI] = useState(0)
  const [img, status] = useImage(candidates[i] || '', 'anonymous')

  useEffect(() => {
    if (status === 'failed' && i < candidates.length - 1) setI(v => v + 1)
  }, [status, i, candidates.length])

  if (!img) return null

  // contain math
  const iw = Math.max(0, w - 2 * padding)
  const ih = Math.max(0, h - 2 * padding)
  const sx = iw / img.width
  const sy = ih / img.height
  const scale = Math.min(sx, sy)
  const drawW = img.width * scale
  const drawH = img.height * scale
  const drawX = x + padding + (iw - drawW) / 2
  const drawY = y + padding + (ih - drawH) / 2

  return <KImage image={img as any} x={drawX} y={drawY} width={drawW} height={drawH} />
}

function Header({ dateRange, theme }: { dateRange: string; theme: Theme }) {
  // Colors taken from the theme (alternating stripes + scallops)
  const stripeA = theme.category.textColor; // dark (e.g. green/red)
  const stripeB = theme.category.bgColor;   // light (e.g. beige)

  // Awning geometry
  const scallopR   = 80;              // half-circle radius
  const scallopW   = scallopR * 2;    // one bay width
  const columnH    = 90;              // vertical stripe height above scallops
  const overlapPx  = 2;               // tiny overlap to kill the hairline
  const awningH    = columnH + scallopR; // total awning height (top → bottom of scallops)

  // Typography
  const nameFS = 140;
  const dateFS = 90;

  // Vertical layout:
  // Place the date, then center the store name between awning bottom and date top.
  const dateY  = awningH + 230;                          // top of the date line
  const nameY  = awningH + Math.max(80, (dateY - awningH - nameFS) / 2); // centered padding

  return (
    <Group>
      {/* Alternating vertical columns. Extend a hair past the join to avoid a white seam. */}
      {Array.from({ length: Math.ceil(CANVAS_W / scallopW) + 2 }).map((_, i) => {
        const fill = i % 2 === 0 ? stripeA : stripeB;
        const x = i * scallopW;
        return (
          <Rect
            key={`col-${i}`}
            x={x}
            y={0}
            width={scallopW}
            height={columnH + overlapPx} // extend slightly to overlap scallops
            fill={fill}
          />
        );
      })}

      {/* Scallops; shift up by overlapPx so they also overlap the columns */}
      <Group y={columnH - overlapPx} clip={{ x: 0, y: 0, width: CANVAS_W, height: scallopR + overlapPx * 2 }}>
        {Array.from({ length: Math.ceil(CANVAS_W / scallopW) + 2 }).map((_, i) => {
          const fill = i % 2 === 0 ? stripeA : stripeB;
          const cx = i * scallopW + scallopR;
          return <Circle key={`sc-${i}`} x={cx} y={0} radius={scallopR} fill={fill} />;
        })}
      </Group>

      {/* Store name — centered in the space between the awning and the date */}
      <KText
        x={0}
        y={nameY}
        width={CANVAS_W}
        align="center"
        text="Kim's Quality Foods"
        fontSize={nameFS}
        fontStyle="800"
        fill={theme.companyNameColor}
        fontFamily={theme.fontFamily}
      />

      {/* “SALE WEEK” to the left */}
      <KText
        x={MARGIN}
        y={dateY - 28} // small visual alignment tweak with the date baseline
        width={420}
        align="left"
        text={'SALE\nWEEK'}
        fontSize={58}
        lineHeight={1.0}
        fontStyle="600"
        fill={theme.companyNameColor}
        fontFamily={theme.fontFamily}
      />

      {/* Date (centered) */}
      <KText
        x={0}
        y={dateY}
        width={CANVAS_W}
        align="center"
        text={dateRange}
        fontSize={dateFS}
        fill={theme.dateTextColor}
        fontFamily={theme.fontFamily}
      />

      {/* Underline after date */}
      <Rect
        x={MARGIN}
        y={dateY + 140}
        width={CANVAS_W - 2 * MARGIN}
        height={8}
        fill={stripeA}
      />
    </Group>
  );
}

function Footer({ theme }: { theme: Theme }) {
  const t = 'OPEN 9:00 A.M. – 9:00 P.M. • 7 DAYS A WEEK'
  const a = '70 MAIN STREET SOUTH, MINNEDOSA | 204-867-2821'
  const barH = 220
  const contentW = CANVAS_W * 0.75
  const contentX = (CANVAS_W - contentW) / 2
  const scale = 1 / 0.75
  const titleFS = 48 * scale   // ≈ 64
  const addrFS  = 44 * scale   // ≈ 58.7

  return (
    <Group y={CANVAS_H - barH}>
      <Rect 
        x={0} 
        y={0} 
        width={CANVAS_W} 
        height={barH} 
        fill={theme.category.textColor} 
        cornerRadius={[40, 40, 0, 0]}
      />
      <KText
        x={contentX}
        y={40}
        width={contentW}
        align="center"
        text={t}
        fontSize={titleFS}
        fill="#FFF"
        fontFamily={theme.fontFamily}
      />
      <KText
        x={contentX}
        y={110}
        width={contentW}
        align="center"
        text={a}
        fontSize={addrFS}
        fill="#E9F5EE"
        fontFamily={theme.fontFamily}
      />
    </Group>
  )
}

// Oval (elliptical) burst: alternate inner/outer points around an ellipse.
function ovalBurstPoints(W:number, H:number, depth:number, spikes:number){
  const pts:number[]=[]
  const rx = W/2, ry = H/2
  const outerRx = rx + depth
  const outerRy = ry + depth * 0.85
  for(let i=0;i<spikes;i++){
    const a = (i / spikes) * Math.PI * 2
    const isOuter = i % 2 === 1
    const R_x = isOuter ? outerRx : rx
    const R_y = isOuter ? outerRy : ry
    pts.push(Math.cos(a)*R_x, Math.sin(a)*R_y)
  }
  return pts
}

function PriceBadge({ x, y, price, theme }: { x: number; y: number; price: string; theme: Theme }) {
  const bg = theme.saleBubble.bgColor
  const tc = theme.saleBubble.textColor
  const style = theme.saleBubble.style

  // grow for longer prices so text never squishes
  const len = price.length
  const scale = len >= 6 ? 1.28 : len >= 5 ? 1.16 : len >= 4 ? 1.06 : 0.96

  const baseW = 240, baseH = 130
  const W = baseW * scale
  const H = baseH * scale

  const spikes = 28
  const depth  = 18 * scale
  const pillR  = 70 * scale
  const badgeR = 24 * scale
  const circleR = Math.max(W, H)/2
  const font = (len >= 5 ? 60 : 56) * scale

  return (
    <Group x={x} y={y}>
      {style === 'starburst' && <Line points={ovalBurstPoints(W, H, depth, spikes)} closed fill={bg} />}
      {style === 'pill' && <Rect x={-W/2} y={-H/2} width={W} height={H} cornerRadius={pillR} fill={bg} />}
      {style === 'badge' && <Rect x={-W/2} y={-H/2} width={W} height={H} cornerRadius={badgeR} fill={bg} />}
      {style === 'sticker' && <Circle radius={circleR/1.1} fill={bg} />}
      <KText
        text={price} fontSize={font} fill={tc}
        width={W} height={H} offsetX={W/2} offsetY={H/2}
        align="center" verticalAlign="middle" fontFamily={theme.fontFamily}
      />
    </Group>
  )
}

export function FeaturedLayer({ items, dateRange, theme }: { items: FeaturedItem[]; dateRange: string; theme: Theme }) {
  // --- Layout knobs ---
  const HEADER_TO_GRID_PAD = 40;   // gap below header underline
  const FOOTER_TO_GRID_PAD = 60;   // gap above footer
  const FOOTER_H          = 220;   // keep in sync with Footer.barH

  // Header ends at its underline (≈560px from top in your current Header)
  const headerUnderlineBottom = 560;
  const top = headerUnderlineBottom + HEADER_TO_GRID_PAD;

  const col = 3;
  const row = 3;
  const gx  = 70;  // horizontal gutter
  const gy  = 90;  // vertical gutter

  // Available height = canvas - header - footer - padding
  const availableH = CANVAS_H - top - (FOOTER_H + FOOTER_TO_GRID_PAD);
  const cardH = (availableH - (row - 1) * gy) / row;
  const cardW = (CANVAS_W - 2 * MARGIN - (col - 1) * gx) / col;

  // Fixed band height so the image gets everything else
  const BAND_H   = 120;   // text band height (name + size)
  const GAP_AB   = 16;    // gap between image and band
  const CARD_PAD = 26;    // inner card top/bottom padding

  const badgeMarks: Array<{ x: number; y: number; price: string }> = [];

  return (
    <>
      <Layer>
        <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={theme.backgroundColor} />
        <Header dateRange={dateRange} theme={theme} />

        {items.map((it, i) => {
          const r = Math.floor(i / col);
          const c = i % col;
          const x = MARGIN + c * (cardW + gx);
          const y = top + r * (cardH + gy);

          // Image box uses all remaining space
          const imgBox = {
            x: 40,
            y: CARD_PAD,
            w: cardW - 80,
            h: cardH - CARD_PAD - GAP_AB - BAND_H - CARD_PAD,
            pad: 8,
          };

          const bandX = imgBox.x + 12;
          const bandW = imgBox.w - 24;
          const bandY = imgBox.y + imgBox.h + GAP_AB;

          // price badge position
          const badgeCenterX = x + imgBox.x + imgBox.w - 10;
          const badgeCenterY = y + imgBox.y + 18;
          badgeMarks.push({ x: badgeCenterX, y: badgeCenterY, price: it.price || '$0.00' });

          return (
            <Group key={i} x={x} y={y}>
              <Rect width={cardW} height={cardH} fill="#fff" stroke="#D8D8D8" cornerRadius={20} />

              {/* Image */}
              <Rect x={imgBox.x} y={imgBox.y} width={imgBox.w} height={imgBox.h} fill="#fff" stroke="#CFCFCF" cornerRadius={16} />
              <NetworkImage url={it.imageUrl} x={imgBox.x} y={imgBox.y} w={imgBox.w} h={imgBox.h} padding={imgBox.pad} />

              {/* Name/Size band */}
              <Rect x={bandX} y={bandY} width={bandW} height={BAND_H} cornerRadius={16} fill={theme.featured.bgColor} />
              <Group x={bandX} y={bandY} width={bandW} height={BAND_H}>
                {(() => {
                  const nameFont = 50;
                  const sizeFont = 35;
                  const lineGap  = 10;
                  const totalTextHeight = nameFont + sizeFont + lineGap;
                  const startY = (BAND_H - totalTextHeight) / 2;
                  return (
                    <>
                      <KText
                        x={0} y={startY} width={bandW}
                        text={it.name || 'New Item'}
                        fontSize={nameFont}
                        fill={theme.featured.textColor}
                        align="center" verticalAlign="middle"
                        fontFamily={theme.fontFamily}
                      />
                      <KText
                        x={0} y={startY + nameFont + lineGap} width={bandW}
                        text={it.size || ''}
                        fontSize={sizeFont}
                        fill={theme.featured.textColor}
                        align="center" verticalAlign="middle"
                        fontFamily={theme.fontFamily}
                      />
                    </>
                  );
                })()}
              </Group>
            </Group>
          );
        })}

        <Footer theme={theme} />
      </Layer>

      {/* badges on top */}
      <Layer listening={false}>
        {badgeMarks.map((b, idx) => (
          <PriceBadge key={idx} x={b.x} y={b.y} price={b.price} theme={theme} />
        ))}
      </Layer>
    </>
  );
}

/* ---------- Table metrics & section rendering ---------- */
function sectionMetrics(rowsLen: number, fontScale = 1, sideInset = ROW_SIDE_INSET) {
  const usable   = 2550 - 2 * MARGIN
  const headerH  = 120
  const maxRows  = 30

  const densityScale = clamp(maxRows / Math.max(rowsLen, 1), 0.85, 1)
  const scale        = densityScale * fontScale

  const baseFs  = 36
  const fs      = baseFs * scale
  const leading = 1.75
  const rowH    = fs * leading

  // Rows are narrower than the header:
  const startX       = MARGIN + sideInset
  const innerUsable  = usable - 2 * sideInset

  const height = headerH + 20 + rowsLen * rowH

  const widths = {
    usable,            // header width
    startX,            // x position where rows begin
    nameW:  innerUsable * 0.60,
    sizeW:  innerUsable * 0.15,
    priceW: innerUsable * 0.25,
  }

  return { headerH, rowH, fs, height, widths }
}

function TableSection({
  title, rows, yStart, theme, fontScale = 1, rowSideInset = ROW_SIDE_INSET
}: {
  title: string; rows: Row[]; yStart: number; theme: Theme; fontScale?: number; rowSideInset?: number
}) {
  const { headerH, rowH, fs, widths } = sectionMetrics(rows.length, fontScale, rowSideInset)
  const { usable, startX, nameW, sizeW, priceW } = widths

  return (
    <Group y={yStart}>
      {/* Full-width header bar */}
      <Rect x={MARGIN} y={0} width={usable} height={headerH} fill={theme.category.bgColor} cornerRadius={24} />
      <KText
        x={MARGIN + 24} y={24}
        text={title.toUpperCase()} fontSize={48} fontStyle="700"
        fill={theme.category.textColor} fontFamily={theme.fontFamily}
      />

      {/* Narrower rows */}
      <Group y={headerH + 20}>
        {rows.map((r, i) => (
          <Group key={i} y={i * rowH}>
            <KText x={startX}               y={0} width={nameW}  text={r.name}  fontSize={fs} fill={theme.saleItem.textColor} fontFamily={theme.fontFamily} />
            <KText x={startX + nameW}       y={0} width={sizeW}  text={r.size}  fontSize={fs} fill={theme.saleItem.textColor} fontFamily={theme.fontFamily} />
            <KText x={startX + nameW + sizeW} y={0} width={priceW} text={r.price} fontSize={fs} fill={theme.saleItem.textColor} align="right" fontFamily={theme.fontFamily} />
          </Group>
        ))}
      </Group>
    </Group>
  )
}

/* ---------------- Grocery (image 2) ---------------- */
export function GroceryLayer({ rows, dateRange, theme }: { rows: Row[]; dateRange: string; theme: Theme }) {
  const scale = theme.saleItem?.fontScaleGrocery ?? 1
  return (
    <Layer>
      <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={theme.backgroundColor} />
      <Header dateRange={dateRange} theme={theme} />
      <TableSection title="Grocery" rows={rows} yStart={580} theme={theme} fontScale={scale} />
      <Footer theme={theme} />
    </Layer>
  )
}

/* ---------------- Groups (image 3) — contiguous layout ---------------- */
export function GroupsLayer({
  frozen, meat, produce, dateRange, theme,
}: { frozen: Row[]; meat: Row[]; produce: Row[]; dateRange: string; theme: Theme }) {
  const top = 580
  const scale = theme.saleItem?.fontScaleGroups ?? 1

  const frozenM  = sectionMetrics(frozen.length,  scale)
  const meatM    = sectionMetrics(meat.length,    scale)
  const produceM = sectionMetrics(produce.length, scale)

  const gap = (rowH:number) => rowH * 0.5 // one half-row gap between sections

  const yFrozen = top
  const yMeat   = yFrozen + frozenM.height  + gap(meatM.rowH)
  const yProd   = yMeat   + meatM.height    + gap(produceM.rowH)

  return (
    <Layer>
      <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={theme.backgroundColor} />
      <Header dateRange={dateRange} theme={theme} />
      <TableSection title="Frozen Foods" rows={frozen}  yStart={yFrozen} theme={theme} fontScale={scale} />
      <TableSection title="Meat"         rows={meat}    yStart={yMeat}   theme={theme} fontScale={scale} />
      <TableSection title="Produce"      rows={produce} yStart={yProd}   theme={theme} fontScale={scale} />
      <Footer theme={theme} />
    </Layer>
  )
}
