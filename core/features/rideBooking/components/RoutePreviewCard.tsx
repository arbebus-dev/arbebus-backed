import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { RideProduct } from "../models";

type Props = {
  visible?: boolean;
  destinationText: string;
  routeSummary: string;
  etaText: string;
  products: RideProduct[];
  selectedProductId?: string;
  onSelectProduct: (product: RideProduct) => void;
  onConfirm: () => void;
};

export const RoutePreviewCard = ({
  visible = true,
  destinationText,
  routeSummary,
  etaText,
  products,
  selectedProductId,
  onSelectProduct,
  onConfirm,
}: Props) => {
  if (!visible) return null;
const translateY = useRef(new Animated.Value(100)).current;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.destination}>{destinationText}</Text>
        <Text style={styles.meta}>
          {routeSummary} • {etaText}
        </Text>
      </View>

      {products.map((product) => {
        const isSelected = product.id === selectedProductId;

        return (
          <Pressable
            key={product.id}
            onPress={() => onSelectProduct(product)}
            style={[styles.productItem, isSelected && styles.productItemSelected]}
          >
            <View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productMeta}>
                {product.etaMinutes} min • {product.capacity} seats
              </Text>
            </View>

            <Text style={styles.price}>{product.estimatedPrice}</Text>
          <Pressable style={styles.confirmButton} onPress={onConfirm}>
  <Text style={styles.confirmButtonText}>Confirm ride</Text>
</Pressable>
          </Pressable>
        );
      })}
  <Animated.View
    style={[
      styles.container,
      {
        transform: [{ translateY }],
      },
    ]}
  ></Animated.View>
      <Pressable style={styles.confirmButton} onPress={onConfirm}>
        <Text style={styles.confirmButtonText}>Confirm ride</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  destination: {
    fontSize: 18,
    fontWeight: "600",
  },
  meta: {
    marginTop: 4,
    color: "#666",
  },
  productItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productItemSelected: {
    opacity: 0.7,
  },
  productName: {
    fontSize: 16,
    fontWeight: "500",
  },
  productMeta: {
    marginTop: 2,
    color: "#666",
  },
  price: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#111",
  },
  confirmButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});