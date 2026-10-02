import { describe, expect, it, jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Model } from "mongoose";

import type { RecipeDocument } from "../../database/recipe.schema";
import { RecipesLegacyRepository } from "../../database/recipes-legacy.repository";
import { RecipesService } from "../recipes.service";

describe("RecipesService", () => {
  const mockModel = {
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const createService = async (): Promise<RecipesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecipesService,
        {
          provide: RecipesLegacyRepository,
          useValue: new RecipesLegacyRepository(
            mockModel as unknown as Model<RecipeDocument>,
          ),
        },
      ],
    }).compile();

    return moduleRef.get(RecipesService);
  };

  it("returns recipes sorted by newest first", async () => {
    const recipes = [{ title: "蛋炒飯" }];
    const sort =
      jest.fn<
        (order: Record<string, number>) => { exec: () => Promise<unknown[]> }
      >();
    sort.mockReturnValue({ exec: () => Promise.resolve(recipes) });
    mockModel.find.mockReturnValue({ sort });

    const service = await createService();
    await expect(service.findAll()).resolves.toEqual(recipes);
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("throws NotFoundException for a missing recipe", async () => {
    mockModel.findById.mockReturnValue({
      exec: () => Promise.resolve(null),
    });

    const service = await createService();
    await expect(service.findById("missing-id")).rejects.toThrow(
      NotFoundException,
    );
  });
});
