/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { MoodType } from "../types";

interface PapitaMascotProps {
  mood: MoodType;
  className?: string;
}

export default function PapitaMascot({ mood, className = "" }: PapitaMascotProps) {
  // Translate mood to status text for screen readers or secondary titles
  const getMoodConfig = () => {
    switch (mood) {
      case "feliz":
        return {
          bgGradient: "from-amber-200 to-yellow-100",
          statusText: "¡Se nota que estás de buen ánimo! Sigue así.",
          label: "Feliz y radiante"
        };
      case "cansado":
        return {
          bgGradient: "from-blue-100 to-indigo-50",
          statusText: "Hoy estás un poco cansado. No te sobreexijas.",
          label: "Cansado o con sueño"
        };
      case "estresado":
        return {
          bgGradient: "from-rose-100 to-orange-50",
          statusText: "Mucha carga laboral hoy. Respira profundo.",
          label: "Estresado u abrumado"
        };
      case "triste":
        return {
          bgGradient: "from-sky-100 to-slate-100",
          statusText: "Un día difícil... Papita te acompaña y abraza.",
          label: "Triste o desanimado"
        };
      case "neutro":
      default:
        return {
          bgGradient: "from-lavender-100 to-white",
          statusText: "Manteniendo el equilibrio. Todo tranquilo.",
          label: "Neutro y enfocado"
        };
    }
  };

  const config = getMoodConfig();

  // Animations of floating elements (Zzz, tears, sweat)
  const zzzVariant = {
    animate: {
      y: [-2, -20, -30],
      x: [0, 8, 12],
      opacity: [0, 1, 0],
      scale: [0.6, 1.1, 0.7],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    }
  };

  const sweatVariant = {
    animate: {
      y: [0, 10, 15],
      opacity: [1, 1, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeIn",
      }
    }
  };

  return (
    <div id="papita-mascot-container" className={`flex flex-col items-center justify-center ${className}`}>
      {/* Dynamic Aura background reflection depending on mood */}
      <div className="relative flex items-center justify-center w-48 h-48">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 3, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute inset-2 rounded-full blur-2xl opacity-40 bg-gradient-to-tr ${config.bgGradient}`}
        />

        {/* Mascot Body */}
        <motion.svg
          viewBox="0 0 120 120"
          className="w-40 h-40 drop-shadow-lg relative z-10"
          animate={{
            y: [0, -4, 0],
            rotate: mood === "estresado" ? [-1, 1, -1] : [-0.5, 0.5, -0.5]
          }}
          transition={{
            duration: mood === "cansado" ? 4 : mood === "estresado" ? 0.8 : 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <defs>
            {/* Soft, rich organic golden-potato gradient */}
            <radialGradient id="potatoGrad" cx="50%" cy="40%" r="55%" fx="35%" fy="25%">
              <stop offset="0%" stopColor="#FBDFC2" />
              <stop offset="40%" stopColor="#F5C48E" />
              <stop offset="100%" stopColor="#C98B4B" />
            </radialGradient>
            
            {/* High-quality depth shadow */}
            <filter id="innerShadow">
              <feComponentTransfer in="SourceAlpha">
                <feFuncA type="linear" slope="0.3" />
              </feComponentTransfer>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feOffset dx="2" dy="4" />
              <feComposite operator="out" in2="SourceGraphic" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.2 0" />
              <feBlend mode="multiply" in2="SourceGraphic" />
            </filter>

            {/* Linear highlight gradient for the head edge */}
            <linearGradient id="highlightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF2E5" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#FBDFC2" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#C98B4B" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Golden organic potato base shape drawing */}
          <path
            d="M 55,16 C 85,12 112,24 108,62 C 104,94 84,106 58,103 C 32,100 12,88 14,60 C 16,30 28,18 55,16 Z"
            fill="url(#potatoGrad)"
          />

          {/* Visual highlight overlay for high-fidelity depth */}
          <path
            d="M 55,16 C 85,12 112,24 108,62 C 104,94 84,106 58,103 C 32,100 12,88 14,60 C 16,30 28,18 55,16 Z"
            fill="url(#highlightGrad)"
            className="pointer-events-none"
          />

          {/* Rosy blush cheeks always present, size adjusts based on emotion */}
          <circle
            cx="32" 
            cy="66" 
            r={mood === "feliz" ? "9" : "7"} 
            fill="#FFA4A4" 
            opacity={mood === "triste" ? "0.3" : "0.6"} 
          />
          <circle 
            cx="84" 
            cy="66" 
            r={mood === "feliz" ? "9" : "7"} 
            fill="#FFA4A4" 
            opacity={mood === "triste" ? "0.3" : "0.6"} 
          />

          {/* Little skin speckles (realism for a potato!) */}
          <circle cx="28" cy="38" r="1.5" fill="#AB7337" opacity="0.4" />
          <circle cx="88" cy="32" r="1.2" fill="#AB7337" opacity="0.3" />
          <circle cx="94" cy="80" r="1.6" fill="#AB7337" opacity="0.4" />
          <circle cx="20" cy="82" r="1.2" fill="#AB7337" opacity="0.3" />
          <circle cx="56" cy="100" r="1.4" fill="#AB7337" opacity="0.3" />

          {/* RENDER EYES BASED ON MOOD */}
          {mood === "feliz" && (
            <g id="eyes-feliz" stroke="#4A2A0C" strokeWidth="4" strokeLinecap="round" fill="none">
              {/* Joy curved lines upward */}
              <path d="M 30,58 Q 38,48 46,58" />
              <path d="M 68,58 Q 76,48 84,58" />
            </g>
          )}

          {mood === "cansado" && (
            <g id="eyes-cansado">
              {/* Heavy drooping eyelids */}
              <ellipse cx="38" cy="56" rx="6" ry="6" fill="#FFF2E5" opacity="0.6" />
              <ellipse cx="76" cy="56" rx="6" ry="6" fill="#FFF2E5" opacity="0.6" />
              <line x1="30" y1="56" x2="46" y2="56" stroke="#4A2A0C" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="68" y1="56" x2="84" y2="56" stroke="#4A2A0C" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 30,52 Q 38,48 46,52" stroke="#AB7337" strokeWidth="1.5" fill="none" opacity="0.6" />
              <path d="M 68,52 Q 76,48 84,52" stroke="#AB7337" strokeWidth="1.5" fill="none" opacity="0.6" />
            </g>
          )}

          {mood === "estresado" && (
            <g id="eyes-estresado">
              {/* Anxious spirals or small tight circles */}
              <circle cx="38" cy="55" r="4.5" fill="none" stroke="#4A2A0C" strokeWidth="3" />
              <circle cx="38" cy="55" r="1.5" fill="#4A2A0C" />
              <circle cx="76" cy="55" r="4.5" fill="none" stroke="#4A2A0C" strokeWidth="3" />
              <circle cx="76" cy="55" r="1.5" fill="#4A2A0C" />
              {/* Angled worried eyebrows */}
              <path d="M 28,45 L 42,50" stroke="#4A2A0C" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 86,45 L 72,50" stroke="#4A2A0C" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}

          {mood === "triste" && (
            <g id="eyes-triste">
              {/* Downward sad curved lines */}
              <path d="M 30,52 Q 38,60 46,52" stroke="#4A2A0C" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 68,52 Q 76,60 84,52" stroke="#4A2A0C" strokeWidth="4" strokeLinecap="round" fill="none" />
              {/* Worried raised inner eyebrows */}
              <path d="M 30,44 Q 38,45 44,40" stroke="#4A2A0C" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M 84,44 Q 76,45 70,40" stroke="#4A2A0C" strokeWidth="2" strokeLinecap="round" fill="none" />
            </g>
          )}

          {mood === "neutro" && (
            <g id="eyes-neutro">
              {/* Cute default vertical capsule eyes */}
              <rect x="35" y="50" width="6" height="10" rx="3" fill="#4A2A0C" />
              <rect x="73" y="50" width="6" height="10" rx="3" fill="#4A2A0C" />
              {/* Cozy eyebrows */}
              <path d="M 32,44 Q 38,42 44,44" stroke="#4A2A0C" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
              <path d="M 70,44 Q 76,42 82,44" stroke="#4A2A0C" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
            </g>
          )}


          {/* RENDER MOUTH BASED ON MOOD */}
          {mood === "feliz" && (
            <path
              d="M 50,68 C 50,82 66,82 66,68 Z"
              fill="#E28E14"
              stroke="#4A2A0C"
              strokeWidth="2.5"
            />
          )}

          {mood === "cansado" && (
            /* Open small yawning circle or half-curved relaxed line */
            <circle cx="58" cy="72" r="4.5" fill="#4A2A0C" />
          )}

          {mood === "estresado" && (
            /* Wavy nervous line */
            <path
              d="M 48,72 Q 53,68 58,72 Q 63,76 68,72"
              stroke="#4A2A0C"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {mood === "triste" && (
            /* Downward sad curve */
            <path
              d="M 48,76 Q 58,68 68,76"
              stroke="#4A2A0C"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {mood === "neutro" && (
            /* Cute simple direct horizontal mouth line */
            <line
              x1="50"
              y1="72"
              x2="66"
              y2="72"
              stroke="#4A2A0C"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}

          {/* DYNAMIC ATTACHMENTS (TEARS / SWEAT / ZZZ) IN SVG FOR MOOD */}
          {mood === "triste" && (
            /* Animated tear falling from the right eye */
            <motion.path
              d="M 72,55 Q 70,68 68,72 C 67,75 70,75 70,72 Z"
              fill="#38BDF8"
              opacity="0.85"
              animate={{
                y: [0, 8, 12],
                scale: [0.8, 1, 0.5],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
          )}

          {mood === "estresado" && (
            /* Sweat droplet flowing down the side */
            <motion.path
              d="M 96,44 Q 97,52 95,58 C 94,60 97,60 96,58 Z"
              fill="#38BDF8"
              variants={sweatVariant}
              animate="animate"
            />
          )}
        </motion.svg>

        {/* Floating animated Zzz labels on top-right of containers */}
        {mood === "cansado" && (
          <div className="absolute top-4 right-4 flex flex-col space-y-1 pointer-events-none z-20">
            <motion.span variants={zzzVariant} animate="animate" className="font-mono font-bold text-[#E28E14] text-lg">Z</motion.span>
            <motion.span variants={{
              animate: {
                y: [-2, -18, -26],
                x: [0, -6, -10],
                opacity: [0, 1, 0],
                scale: [0.5, 0.9, 0.6],
                transition: { duration: 2.5, delay: 0.8, repeat: Infinity, ease: "easeInOut" }
              }
            }} animate="animate" className="font-mono font-600 text-amber-600 text-sm">z</motion.span>
            <motion.span variants={{
              animate: {
                y: [-2, -15, -22],
                x: [0, 4, 8],
                opacity: [0, 1, 0],
                scale: [0.4, 0.7, 0.5],
                transition: { duration: 2.5, delay: 1.5, repeat: Infinity, ease: "easeInOut" }
              }
            }} animate="animate" className="font-mono text-amber-500 text-xs">z</motion.span>
          </div>
        )}

        {/* Excited mood particles */}
        {mood === "feliz" && (
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="absolute top-10 left-6 text-xl"
            >
              ✨
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0, 0.7, 0] }}
              transition={{ duration: 3, delay: 0.5, repeat: Infinity }}
              className="absolute bottom-10 right-6 text-lg"
            >
              🌸
            </motion.div>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-4 right-10 text-xl"
            >
              ❤️
            </motion.div>
          </div>
        )}
      </div>

      {/* Papita status banner */}
      <div className="mt-2 text-center">
        <h3 className="font-sans font-bold text-gray-800 text-lg">
          Papita
        </h3>
        <p className="font-sans text-sm text-gray-500 italic max-w-xs px-4" id="papita-state-phrase">
          "{config.statusText}"
        </p>
      </div>
    </div>
  );
}
