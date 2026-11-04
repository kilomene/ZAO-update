/**
 * iOS UI helpers (visual only): haptics, frosted bars, grabber, icon tiles.
 * Haptics are fire-and-forget and never throw into callers.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet, Platform, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

export const haptic = {
  light: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  medium: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  select: () => { Haptics.selectionAsync().catch(() => {}); },
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};

/** Solid chrome bar (no glass). Bars sit on opaque barTint. */
export function FrostedBar({ theme, style, children, intensity = 80 }) {
  return <View style={[style, { backgroundColor: theme.barTint }]}>{children}</View>;
}

export function Grabber({ theme }) {
  return <View style={[styles.grabber, { backgroundColor: theme.mode === 'dark' ? '#5A5A5E' : '#C7C7CC' }]} />;
}

const AMBIENT_LIGHT = require('../../assets/ui/ambient-light.png');
const AMBIENT_DARK = require('../../assets/ui/ambient-dark.png');

/**
 * Solid card fill (legacy name GlassFill kept for call sites).
 * Frosted BlurView is reserved for IconGlassFill / icon tiles only.
 */
export function GlassFill({ theme, radius = 16, strong = false, intensity, shapeStyle }) {
  const fill = theme.card || theme.glassFill || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF');
  const shape = [StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', backgroundColor: fill }, shapeStyle];
  return <View pointerEvents="none" style={shape} />;
}

/** Frosted glass fill — ONLY for AppIconTile / icon chrome. */
export function IconGlassFill({ theme, radius = 16, intensity = 40, shapeStyle }) {
  const fill = theme.iconGlass || (theme.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)');
  const shape = [StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, shapeStyle];
  if (Platform.OS === 'ios') {
    return (
      <BlurView pointerEvents="none" tint={theme.blurTint} intensity={intensity} style={shape}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      </BlurView>
    );
  }
  return <View pointerEvents="none" style={[shape, { backgroundColor: fill }]} />;
}

/** Solid opaque card surface (no translucent glass). Soft hairline + light shadow. */
export function glassSurface(theme, radius = 16) {
  return {
    backgroundColor: theme.card || theme.glassFill || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF'),
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.separator || theme.glassHighlight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.06,
    elevation: 1,
    overflow: 'hidden',
  };
}

/** Solid canvas — no orb gradient (gradients were read as glass/translucent). */
export function AmbientBackground({ theme }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.ambientBase || theme.background }]} />
  );
}

const AVATAR_ART = require('../../assets/ui/zao-avatar.jpg');
const ALLOW_GRADIENT = require('../../assets/ui/allow-gradient.png');

/** Prefer Ionicons' thin outline variant when one exists (Muse/Grok Bot outline glyphs). */
export function outlineName(name) {
  if (!name || name.endsWith('-outline')) return name;
  const candidate = `${name}-outline`;
  return Ionicons.glyphMap && Ionicons.glyphMap[candidate] ? candidate : name;
}

/** iOS Settings-style rounded-square colored icon tile (v1, kept in the mix build). */
export function IconTile({ name, color, size = 29 }) {
  return (
    <View style={[styles.tile, { backgroundColor: color, width: size, height: size }]}>
      <Ionicons name={name} size={Math.round(size * 0.62)} color="#FFFFFF" />
    </View>
  );
}

/** Muse/Grok 44pt soft circle — filled white (dark #2C2C2E), soft shadow, no outline. */
export function CircleButton({ theme, icon, onPress, size = 44, label, iconSize = 22, style, children }) {
  const fill = theme.chromeButton || (theme.mode === 'dark' ? '#2C2C2E' : '#FFFFFF');
  return (
    <TouchableOpacity
      onPress={() => { haptic.light(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          shadowOpacity: theme.mode === 'dark' ? 0.45 : 0.12,
          elevation: 3,
        },
        style,
      ]}
    >
      {children || <Ionicons name={outlineName(icon)} size={iconSize} color={theme.chromeIcon} />}
    </TouchableOpacity>
  );
}

const AVATAR_ACTIVITIES = ['idle', 'thinking', 'searching', 'computer', 'planning', 'writing'];

/** Thought-bubble prop (thinking): bubble pulses, its three dots light up in sequence. */
function ThoughtBubbleProp({ size, pulse }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] });
  const dot = (range) => pulse.interpolate({ inputRange: [0, 1], outputRange: range });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -size * 0.16, right: -size * 0.46, width: size * 0.78, height: size * 0.58, transform: [{ scale }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 52 40">
        <Circle cx="8" cy="33" r="3" fill="#FFFFFF" stroke="#D1D1D6" strokeWidth="1" />
        <Circle cx="16" cy="25" r="4.5" fill="#FFFFFF" stroke="#D1D1D6" strokeWidth="1" />
        <Path d="M30 3 C40 3 48 9 48 16 C48 23 40 29 30 29 C20 29 12 23 12 16 C12 9 20 3 30 3 Z" fill="#FFFFFF" stroke="#D1D1D6" strokeWidth="1" />
      </Svg>
      <View style={{ position: 'absolute', left: '38%', top: '26%', flexDirection: 'row', gap: size * 0.045 }}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={{
              width: Math.max(3, size * 0.07), height: Math.max(3, size * 0.07), borderRadius: size,
              backgroundColor: '#3A3A3C',
              opacity: dot(i === 0 ? [1, 0.25] : i === 1 ? [0.25, 1] : [0.6, 0.25]),
              transform: [{ translateY: dot(i === 1 ? [1.5, -1.5] : [0, 0]) }],
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

/** Magnifying-glass prop (searching/browsing): sweeps side to side, scanning. */
function MagnifierProp({ size, sweep }) {
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.22, size * 0.22] });
  const rotate = sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-10deg', '0deg', '10deg'] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: size * 0.02, right: -size * 0.30, width: size * 0.64, height: size * 0.64, transform: [{ translateX }, { rotate }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 40 40">
        <Circle cx="16" cy="16" r="10.5" fill="rgba(255,255,255,0.28)" stroke="#3A3A3C" strokeWidth="3.5" />
        <Path d="M24 24 L34.5 34.5" stroke="#3A3A3C" strokeWidth="5" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/** Laptop prop (computer): sits in front of the avatar; two paws tap its keyboard in rhythm. */
function LaptopProp({ size, tap }) {
  const paw = (downFirst) => tap.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: downFirst ? [4.5, 0, 4.5] : [0, 4.5, 0],
  });
  const pawSize = Math.max(6, size * 0.16);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: -size * 0.06, left: size * 0.08, width: size * 0.84, height: size * 0.56 }}>
      <Svg width="100%" height="100%" viewBox="0 0 52 36">
        <Rect x="9" y="2" width="34" height="25" rx="3" fill="#2C2C2E" stroke="#636366" strokeWidth="1" />
        <Rect x="12" y="5" width="28" height="19" rx="1.5" fill="#4FA3FF" opacity="0.9" />
        <Rect x="15" y="9" width="16" height="2.4" rx="1.2" fill="#FFFFFF" opacity="0.85" />
        <Rect x="15" y="14" width="21" height="2.4" rx="1.2" fill="#FFFFFF" opacity="0.55" />
        <Rect x="15" y="19" width="12" height="2.4" rx="1.2" fill="#FFFFFF" opacity="0.7" />
        <Rect x="3" y="27" width="46" height="5" rx="2.5" fill="#1C1C1E" stroke="#636366" strokeWidth="0.75" />
      </Svg>
      <Animated.View style={{ position: 'absolute', bottom: size * 0.10, left: '26%', width: pawSize, height: pawSize, borderRadius: pawSize / 2, backgroundColor: '#F6E3C2', borderWidth: 1, borderColor: '#E3C99B', transform: [{ translateY: paw(true) }] }} />
      <Animated.View style={{ position: 'absolute', bottom: size * 0.10, right: '26%', width: pawSize, height: pawSize, borderRadius: pawSize / 2, backgroundColor: '#F6E3C2', borderWidth: 1, borderColor: '#E3C99B', transform: [{ translateY: paw(false) }] }} />
    </View>
  );
}

/** Clipboard/checklist prop (planning) with orbiting sparkles - planning gets its own treatment, not a recolor. */
function PlanningProp({ size, orbit, pulse }) {
  const rotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const sparkleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -size * 0.03, right: -size * 0.38, width: size * 0.54, height: size * 0.66 }}>
        <Svg width="100%" height="100%" viewBox="0 0 36 46">
          <Rect x="4" y="5" width="28" height="38" rx="4" fill="#FFFFFF" stroke="#D1D1D6" strokeWidth="1.5" />
          <Rect x="12" y="1.5" width="12" height="7" rx="3" fill="#8E8E93" />
          <Path d="M10 17 L13 20 L18 14" stroke="#34C759" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 17 L28 17" stroke="#C7C7CC" strokeWidth="2.4" strokeLinecap="round" />
          <Path d="M10 27 L13 30 L18 24" stroke="#34C759" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 27 L28 27" stroke="#C7C7CC" strokeWidth="2.4" strokeLinecap="round" />
          <Path d="M10 37 L24 37" stroke="#4FA3FF" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="4 3" />
        </Svg>
      </View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -size * 0.16, left: -size * 0.30, width: size * 0.30, height: size * 0.30, opacity: sparkleOpacity, transform: [{ rotate }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Path d="M12 1 L14 9 L22 11 L14 13 L12 21 L10 13 L2 11 L10 9 Z" fill="#FFCC00" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: size * 0.18, right: -size * 0.40, width: size * 0.18, height: size * 0.18, opacity: sparkleOpacity }}>
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Path d="M12 1 L14 9 L22 11 L14 13 L12 21 L10 13 L2 11 L10 9 Z" fill="#FF9F0A" />
        </Svg>
      </Animated.View>
    </>
  );
}

/** Pencil prop (writing): tilted pencil gliding back and forth as if writing a line. */
function PencilProp({ size, write }) {
  const translateX = write.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.10, size * 0.18] });
  const translateY = write.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, size * 0.05, 0] });
  const rotate = write.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '7deg'] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: size * 0.0, right: -size * 0.28, width: size * 0.62, height: size * 0.62, transform: [{ translateX }, { translateY }, { rotate }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 40 40">
        <Path d="M27.5 4.5 L35.5 12.5 L15 33 L5.5 35.5 L8 26 Z" fill="#FFCC00" stroke="#B8860B" strokeWidth="1" />
        <Path d="M24.5 7.5 L32.5 15.5 L29.5 18.5 L21.5 10.5 Z" fill="#FFD60A" />
        <Path d="M5.5 35.5 L8 26 L12.5 30.5 Z" fill="#F6E3C2" />
        <Path d="M5.5 35.5 L7 31.5 L9.5 34 Z" fill="#3A3A3C" />
        <Path d="M27.5 4.5 L30 2.8 L37.5 10.5 L35.5 12.5 Z" fill="#FF6B81" />
      </Svg>
    </Animated.View>
  );
}

/**
 * ZAO's avatar: the plush character (cream, pink cheeks, black Nova
 * hoodie - assets/ui/zao-avatar.jpg), circular-cropped like the header
 * mockups. With an `activity` prop it animates STRICTLY per activity -
 * every kind has its own motion + prop (see avatarActivity.js for how
 * the kind is derived from what ZAO is actually doing):
 *   idle      gentle breathing bob/scale, no prop
 *   thinking  thought bubble beside the head, dots pulsing in sequence
 *   searching magnifying glass sweeping side to side
 *   computer  laptop in front, paws tapping its keyboard in rhythm
 *   planning  clipboard/checklist + orbiting sparkles, slow nod
 *   writing   pencil gliding in a writing motion
 * Unknown kinds fall back to idle. All loops run on the native driver
 * and are stopped on kind change / unmount. Every kind change also
 * fires a spring "pop" so transitions are visible at a glance, and
 * all motion amplitudes are sized to actually read on a phone screen
 * (the first pass's ~2px motions looked static on a real device -
 * owner feedback, 2026-11-04).
 */
export function ZaoAvatar({ size = 40, style, activity = 'idle' }) {
  const kind = AVATAR_ACTIVITIES.includes(activity) ? activity : 'idle';
  const breathe = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const tap = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  // Transition pop: every time the activity CHANGES, the avatar springs
  // in with a visible scale pop so a state change is unmissable at a
  // glance (Muse's avatar visibly reacts when its task changes; a
  // subtle loop alone read as "static" on a real phone).
  const pop = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    pop.setValue(0.8);
    const popAnim = Animated.spring(pop, { toValue: 1, friction: 5, tension: 130, useNativeDriver: true });
    popAnim.start();
    const values = [breathe, sway, pulse, tap, orbit];
    values.forEach((v) => { v.stopAnimation(); v.setValue(0); });
    const ease = Easing.inOut(Easing.sin);
    const loops = [];
    const start = (value, duration, easing = ease) => {
      const anim = Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: duration / 2, easing, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: duration / 2, easing, useNativeDriver: true }),
      ]));
      loops.push(anim);
      anim.start();
    };

    if (kind === 'idle' || kind === 'writing') start(breathe, 2800);
    if (kind === 'thinking') { start(breathe, 3400); start(pulse, 1500); }
    if (kind === 'searching') { start(breathe, 2800); start(sway, 1500); }
    if (kind === 'computer') start(tap, 420, Easing.inOut(Easing.quad));
    if (kind === 'planning') {
      start(breathe, 3600);
      start(pulse, 1800);
      const orbitAnim = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true }));
      loops.push(orbitAnim);
      orbitAnim.start();
    }
    if (kind === 'writing') start(sway, 950);

    return () => { popAnim.stop(); loops.forEach((a) => a.stop()); values.forEach((v) => v.stopAnimation()); };
  }, [kind, breathe, sway, pulse, tap, orbit, pop]);

  // Motion amplitudes are deliberately LARGE (several px at header
  // size, ~4% scale): the first pass used ~2px / 1.2% motions that
  // read as a still photo on a real device - the owner called it out.
  const bobY = kind === 'computer'
    ? tap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -size * 0.05, 0] })
    : breathe.interpolate({ inputRange: [0, 1], outputRange: [0, kind === 'planning' ? size * 0.06 : -size * 0.05] });
  const breatheScale = kind === 'computer'
    ? 1
    : breathe.interpolate({ inputRange: [0, 1], outputRange: [1, kind === 'idle' ? 1.045 : 1.02] });

  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ scale: pop }] }, style]}>
      <Animated.View style={{ width: size, height: size, transform: [{ translateY: bobY }, { scale: breatheScale }] }}>
        <Image
          source={AVATAR_ART}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityLabel="ZAO avatar"
        />
      </Animated.View>
      {kind === 'thinking' && <ThoughtBubbleProp size={size} pulse={pulse} />}
      {kind === 'searching' && <MagnifierProp size={size} sweep={sway} />}
      {kind === 'computer' && <LaptopProp size={size} tap={tap} />}
      {kind === 'planning' && <PlanningProp size={size} orbit={orbit} pulse={pulse} />}
      {kind === 'writing' && <PencilProp size={size} write={sway} />}
    </Animated.View>
  );
}

/** Muse-style gradient Allow pill (#0762D5 -> #4156E5). */
export function AllowButton({ label = 'Allow', onPress, disabled, style, textStyle, icon }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.pillBtn, disabled && { opacity: 0.5 }, style]} accessibilityRole="button">
      <ImageBackground source={ALLOW_GRADIENT} resizeMode="stretch" style={styles.pillFill} imageStyle={{ borderRadius: 999 }}>
        {icon ? <Ionicons name={icon} size={16} color="#FFFFFF" style={{ marginRight: 6 }} /> : null}
        <Text style={[styles.pillText, { color: '#FFFFFF' }, textStyle]}>{label}</Text>
      </ImageBackground>
    </TouchableOpacity>
  );
}

/** Muse Deny pill (#F3F4F6, dark text). */
export function DenyButton({ theme, label = 'Deny', onPress, disabled, style, textStyle }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.pillBtn, { backgroundColor: theme.deny }, disabled && { opacity: 0.5 }, style]} accessibilityRole="button">
      <View style={styles.pillFill}>
        <Text style={[styles.pillText, { color: theme.denyText }, textStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function Hairline({ theme, inset = 0 }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  grabber: { width: 36, height: 5, borderRadius: 2.5, alignSelf: 'center', marginTop: 6, marginBottom: 8 },
  tile: { borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  circle: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 2,
  },
  pillBtn: { flex: 1, height: 44, borderRadius: 999, overflow: 'hidden' },
  pillFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  pillText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
});
