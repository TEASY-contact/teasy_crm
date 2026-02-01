// src/theme/theme.ts
import { extendTheme } from "@chakra-ui/react";

export const theme = extendTheme({
  colors: {
    brand: {
      500: "#805AD5", // purple.500
    },
  },
  styles: {
    global: {
      "html, body, button, input, select, textarea, label, span, div": {
        letterSpacing: "0.5px",
      },
      "input::placeholder, textarea::placeholder": {
        color: "gray.300",
        fontSize: "14px",
      },
      body: {
        bg: "gray.50",
        color: "gray.800",
      },
      // S25 Portrait Lock & Optimization
      "@media screen and (max-width: 430px)": {
        html: {
          fontSize: "14px",
        },
      },
    },
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          transition: "transform 0.2s ease-in-out",
          _hover: {
            transform: "scale(1.01)",
          },
        },
      },
    },
    Button: {
      baseStyle: {
        _active: {
          transform: "scale(0.95)",
        },
      },
    },
    Badge: {
      baseStyle: {
        fontSize: "10px",
        textTransform: "none",
        letterSpacing: "0.5px",
      },
    },
  },
});
