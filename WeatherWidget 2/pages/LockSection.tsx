// App 页里的「锁屏样式」：圆形、矩形各选一款默认。
//
// 一个锁屏组件只能放一款，所以真正的选款在组件自己身上：组件「参数」里填编号（3）或名字（紫外线指数）。
// 这里选的是「参数没填、或者填的不是这种形状的款式时」用的默认款。
//
// 改了马上存下、马上让锁屏的小组件重画。款式表在 core/lock.ts，画法在 widget/lock/styles.tsx。

import { Button, Picker, Text } from "scripting";
import { defaultLockStyle, lockStyleTitle, lockStylesOf, type LockFamilyKey, type LockStyle } from "../core/lock";
import type { Settings } from "../core/settings";
import { Fold, type FoldState } from "./Fold";

const FOOTER =
  "在锁屏组件的「参数」里填编号或名字来选款\n" +
  "比如圆形填 3（紫外线指数）\n" +
  "矩形填 短临预报、降雨量预报、实况与逐时、风与湿度、实况与逐日\n" +
  "矩形填 9~13 也认（那是原来圆形、矩形连着数的老编号）\n" +
  "参数空着、或填的不是这种形状的款式，用这里选的那一款";

/** 设置里存的是 value；没选过、存的值不认识时，显示第一款 */
function currentValue(saved: string, family: LockFamilyKey): string {
  return defaultLockStyle(family, saved).value;
}

function StylePicker({
  family,
  title,
  value,
  onChange,
}: {
  family: LockFamilyKey;
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Picker title={title} value={value} onChanged={onChange}>
      {lockStylesOf(family).map((style: LockStyle) => (
        <Text tag={style.value}>
          {lockStyleTitle(style)}
        </Text>
      ))}
    </Picker>
  );
}

export function LockSection({ settings, onChange, fold }: { settings: Settings; onChange: (next: Settings) => void; fold: FoldState }) {
  const circle = currentValue(settings.lockCircle, "circle");
  const rect = currentValue(settings.lockRect, "rect");
  const custom = settings.lockCircle !== "" || settings.lockRect !== "";
  return (
    <Fold title="锁屏样式" note={custom ? "已自定义" : "默认"} fold={fold} footer={FOOTER}>
      <StylePicker family="circle" title="圆形：默认哪一款" value={circle} onChange={(value) => onChange({ ...settings, lockCircle: value })} />
      <StylePicker family="rect" title="矩形：默认哪一款" value={rect} onChange={(value) => onChange({ ...settings, lockRect: value })} />
      {custom ? (
        <Button action={() => onChange({ ...settings, lockCircle: "", lockRect: "" })}>
          <Text foregroundStyle="systemBlue">恢复默认款式</Text>
        </Button>
      ) : null}
    </Fold>
  );
}
