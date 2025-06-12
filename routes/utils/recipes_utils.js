const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";
const DButils = require("./DButils");

/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info
 */

async function getRecipeInformation(recipe_id) {
  return await axios.get(`${api_domain}/${recipe_id}/information`, {
    params: {
      includeNutrition: false,
      apiKey: process.env.spooncular_apiKey,
    },
  });
}

async function getRecipeDetails(recipe_id) {
  let recipe_info = await getRecipeInformation(recipe_id);
  let { id, title, readyInMinutes, image, vegan, vegetarian, glutenFree } =
    recipe_info.data;

  return {
    id: id,
    title: title,
    readyInMinutes: readyInMinutes,
    image: image,
    vegan: vegan,
    vegetarian: vegetarian,
    glutenFree: glutenFree,
  };
}

/**
 * This function returns a list of preview data for user-created recipes
 * @param {Array} recipe_id -  recipe id created by the user
 * @param {string} user_id - id of the user who created the recipes
 * @returns {Array} - list of recipe preview objects
 */
async function getUserRecipePreview(recipe_id, user_id) {
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree
    FROM user_recipes
    WHERE recipe_id = ${recipe_id} AND user_id = '${user_id}'
  `);

  if (recipes.length === 0) return [];

  const recipe = recipes[0];

  return {
    id: recipe.recipe_id,
    title: recipe.title,
    image: recipe.image,
    readyInMinutes: recipe.readyInMinutes,
    vegan: recipe.vegan,
    vegetarian: recipe.vegetarian,
    glutenFree: recipe.glutenFree,
  };
}

async function getAllRecipeDetails(recipe_id) {
  console.log("recipe_id =", recipe_id);
  let recipe_info = await getRecipeInformation(recipe_id);
  let {
    id,
    title,
    readyInMinutes,
    image,
    vegetarian,
    vegan,
    glutenFree,
    extendedIngredients,
    instructions,
    servings,
  } = recipe_info.data;

  return {
    id,
    title,
    readyInMinutes,
    image,
    vegetarian,
    vegan,
    glutenFree,
    ingredients: extendedIngredients.map((ingredient) => ({
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
    })),
    instructions,
    servings,
  };
}

async function getAllUserFullRecipe(recipe_id, user_id) {
  const recipe = await DButils.execQuery(
    `SELECT * FROM user_recipes WHERE recipe_id = '${recipe_id}' AND user_id = '${user_id}'`
  );

  if (!recipe || recipe.length === 0) {
    throw { status: 404, message: "User recipe not found" };
  }

  const {
    id,
    title,
    image,
    readyInMinutes,
    vegan,
    vegetarian,
    glutenFree,
    instructions,
    servings,
    ingredients,
  } = recipe[0];

  return {
    id,
    title,
    image,
    readyInMinutes,
    vegan: !!vegan,
    vegetarian: !!vegetarian,
    glutenFree: !!glutenFree,
    instructions,
    servings,
    ingredients: ingredients,
  };
}


async function getAllFamilyFullRecipe(recipe_id, user_id) {
  const recipe_rows = await DButils.execQuery(`
    SELECT * FROM family_recipes
    WHERE recipe_id = '${recipe_id}' AND user_id = '${user_id}'
  `);

  if (recipe_rows.length === 0) {
    throw { status: 404, message: "Family recipe not found" };
  }

  const recipe = recipe_rows[0];

  return {
    id: recipe.recipe_id,
    title: recipe.title,
    image: recipe.image,
    readyInMinutes: recipe.readyInMinutes,
    vegan: !!recipe.vegan,
    vegetarian: !!recipe.vegetarian,
    glutenFree: !!recipe.glutenFree,
    instructions: recipe.instructions,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    whenToPrepare: recipe.when_to_prepare,
    owner: recipe.owner_name
  };
}

async function addUserRecipe(user_id, recipeData) {
  const {
    title,
    readyInMinutes,
    image,
    vegetarian,
    vegan,
    glutenFree,
    ingredients,
    instructions,
    servings,
  } = recipeData;

  const ingredients_json = JSON.stringify(ingredients);

  const query = `
    INSERT INTO user_recipes
    (user_id, title, readyInMinutes, image, vegetarian, vegan, glutenFree, instructions, servings, ingredients)
    VALUES (
      '${user_id}',
      '${title}',
      ${readyInMinutes},
      '${image}',
      ${vegetarian ? 1 : 0},
      ${vegan ? 1 : 0},
      ${glutenFree ? 1 : 0},
      '${instructions}',
      ${servings},
      '${ingredients_json}'
    )
  `;

  await DButils.execQuery(query);
}

async function getAllUserPreviewRecipes(user_id) {
    const recipes = await DButils.execQuery(`
        SELECT recipe_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree
        FROM user_recipes
        WHERE user_id = '${user_id}'
    `);

    return recipes.map((recipe) => ({
        id: recipe.recipe_id,
        title: recipe.title,
        image: recipe.image,
        readyInMinutes: recipe.readyInMinutes,
        vegan: recipe.vegan,
        vegetarian: recipe.vegetarian,
        glutenFree: recipe.glutenFree,
    }));
}
async function addFamilyRecipe(user_id, recipeData) {
  const {
    title,
    image,
    readyInMinutes,
    vegan,
    vegetarian,
    glutenFree,
    ingredients,
    instructions,
    servings,
    when_to_prepare,
    owner_name = "Me"
  } = recipeData;

  const ingredients_json = JSON.stringify(ingredients);

  const query = `
    INSERT INTO family_recipes
    (user_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree, ingredients, instructions, servings, when_to_prepare, owner_name)
    VALUES (
      '${user_id}',
      '${title}',
      '${image}',
      ${readyInMinutes},
      ${vegan ? 1 : 0},
      ${vegetarian ? 1 : 0},
      ${glutenFree ? 1 : 0},
      '${ingredients_json}',
      '${instructions}',
      ${servings},
      '${when_to_prepare}',
      '${owner_name}'
    )
  `;

  await DButils.execQuery(query);
}


async function getAllFamilyPreviewRecipes(user_id) {
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, title, image, readyInMinutes, vegan, vegetarian, glutenFree, when_to_prepare, owner_name
    FROM family_recipes
    WHERE user_id = '${user_id}'
  `);

  return recipes.map((recipe) => ({
    id: recipe.recipe_id,
    title: recipe.title,
    image: recipe.image,
    readyInMinutes: recipe.readyInMinutes,
    vegan: recipe.vegan,
    vegetarian: recipe.vegetarian,
    glutenFree: recipe.glutenFree,
    when_to_prepare: recipe.when_to_prepare,
    owner: recipe.owner_name
  }));
}

async function addRecipeView(user_id, recipe_id, source) {
  const existingViews = await DButils.execQuery(`
    SELECT recipe_id
    FROM last_viewed
    WHERE user_id = '${user_id}'
    ORDER BY view_time DESC
  `);

  const alreadyExists = existingViews.find((row) => row.recipe_id == recipe_id);
  if (!alreadyExists && existingViews.length >= 3) {
    const oldestRecipe = existingViews[existingViews.length - 1].recipe_id;
    await DButils.execQuery(`
      DELETE FROM last_viewed
      WHERE user_id = '${user_id}' AND recipe_id = '${oldestRecipe}'
    `);
  }

  const query = `
    INSERT INTO last_viewed (user_id, recipe_id, source, view_time)
    VALUES ('${user_id}', '${recipe_id}', '${source}', CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      view_time = CURRENT_TIMESTAMP,
      source = VALUES(source)
  `;
  await DButils.execQuery(query);
}


async function getLastViewedRecipes(user_id) {
  const lastViewedRows = await DButils.execQuery(`
    SELECT recipe_id, source
    FROM last_viewed
    WHERE user_id = '${user_id}'
    ORDER BY view_time DESC
    LIMIT 3
  `);

  const recipePreviews = await Promise.all(
    lastViewedRows.map(async ({ recipe_id, source }) => {
      if (source === "user") {
        return await getUserRecipePreview(recipe_id, user_id);
      } else if (source === "api") {
        return await getRecipeDetails(recipe_id);
      } else {
        throw new Error("Unknown recipe source: " + source);
      }
    })
  );

  return recipePreviews;
}

async function getRandomRecipes(number = 3) {
  try {
    const response = await axios.get(`${api_domain}/random`, {
      params: {
        number,
        includeNutrition: false,
        apiKey: process.env.spooncular_apiKey
      }
    });

    let recipes_info = await response;

    return recipes_info.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      readyInMinutes: recipe.readyInMinutes,
      image: recipe.image,
      popularity: recipe.aggregateLikes,
      vegan: recipe.vegan,
      vegetarian: recipe.vegetarian,
      glutenFree: recipe.glutenFree
    }));
  } catch (error) {
    console.error("Error fetching random recipes:", error.message);
    throw { status: 502, message: "Failed to fetch random recipes from Spoonacular API" };
  }
}


exports.getRandomRecipes = getRandomRecipes;
exports.getAllFamilyFullRecipe = getAllFamilyFullRecipe;
exports.getLastViewedRecipes = getLastViewedRecipes;
exports.addRecipeView = addRecipeView;
exports.getAllFamilyPreviewRecipes = getAllFamilyPreviewRecipes;
exports.addFamilyRecipe = addFamilyRecipe;
exports.getAllUserPreviewRecipes = getAllUserPreviewRecipes;
exports.getAllRecipeDetails = getAllRecipeDetails;
exports.getAllUserFullRecipe = getAllUserFullRecipe;
exports.getUserRecipePreview = getUserRecipePreview;
exports.getRecipeDetails = getRecipeDetails;
exports.addUserRecipe = addUserRecipe; 